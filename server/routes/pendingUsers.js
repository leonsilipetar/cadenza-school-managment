const express = require('express');
const router = express.Router();
const { PendingUser, Program, User, School, Mentor } = require('../models');
const { verifyToken } = require('../controllers/user-controller');
const { createNotification } = require('../controllers/notification-controller');
const { Op } = require('sequelize');
const { pendingUserLimiter } = require('../middleware/rateLimiter');
const fetch = require('node-fetch'); // Using node-fetch instead of axios
const nodemailer = require('nodemailer');

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

// Verify reCAPTCHA token
const verifyRecaptcha = async (token) => {
  try {
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${token}`
    );
    const data = await response.json();
    return data.success && data.score >= 0.5;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
};

// Check if email exists in Users or PendingUsers tables
const checkEmailExists = async (email) => {
  // Check Users table
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return {
      exists: true,
      message: 'Ova email adresa je već registrirana u sustavu.'
    };
  }

  // Check PendingUsers table
  const pendingUser = await PendingUser.findOne({
    where: {
      email,
      status: 'pending' // Only check pending requests
    }
  });
  if (pendingUser) {
    return {
      exists: true,
      message: 'Već postoji aktivan zahtjev za registraciju s ovom email adresom.'
    };
  }

  return { exists: false };
};

// Add new endpoint for checking email
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email je obavezan.' });
    }

    const result = await checkEmailExists(email);
    res.json(result);
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ message: 'Greška pri provjeri email adrese.' });
  }
});

// Public route for submitting registration request
router.post('/signup/pending', pendingUserLimiter, async (req, res) => {
  try {
    const {
      ime,
      prezime,
      email,
      oib,
      datumRodjenja,
      adresa,
      roditelj1,
      roditelj2,
      programId,
      pohadjaTeoriju,
      napomene,
      maloljetniClan,
      schoolId,
      recaptchaToken,
      brojMobitela,
      customAttributes,
      pohadanjeNastave
    } = req.body;

    // Check if email exists
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      return res.status(400).json({ message: emailCheck.message });
    }

    // Verify reCAPTCHA
    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      return res.status(400).json({
        message: 'reCAPTCHA verifikacija nije uspjela. Molimo pokušajte ponovno.'
      });
    }

    // Create or update a pending user idempotently on (email) uniqueness
    const now = new Date();
    const pendingUser = await PendingUser.upsert({
      ime,
      prezime,
      email,
      oib,
      datumRodjenja,
      adresa,
      roditelj1,
      roditelj2,
      programId,
      pohadjaTeoriju,
      napomene,
      maloljetniClan,
      schoolId,
      brojMobitela,
      customAttributes,
      pohadanjeNastave,
      status: 'pending',
      updatedAt: now
    }, { returning: true });

    const created = Array.isArray(pendingUser) ? pendingUser[0] : pendingUser;

    // Send notification to school admins about new pending user
    try {
      // Find all admins for this school (both Users and Mentors)
      const userAdmins = await User.findAll({
        where: {
          schoolId: schoolId,
          isAdmin: true,
          fcmToken: { [Op.ne]: null }
        },
        attributes: ['id', 'fcmToken', 'ime', 'prezime']
      });

      const mentorAdmins = await Mentor.findAll({
        where: {
          schoolId: schoolId,
          isAdmin: true,
          fcmToken: { [Op.ne]: null }
        },
        attributes: ['id', 'fcmToken', 'ime', 'prezime']
      });

      const allAdmins = [
        ...userAdmins.map(admin => ({ ...admin.toJSON(), type: 'User' })),
        ...mentorAdmins.map(admin => ({ ...admin.toJSON(), type: 'Mentor' }))
      ];

      console.log(`Found ${allAdmins.length} school admins with FCM tokens for new pending user:`, allAdmins.map(admin => ({ id: admin.id, type: admin.type, fcmToken: admin.fcmToken?.substring(0, 20) + '...' })));

      // Send individual notifications to each admin
      for (const admin of allAdmins) {
        try {
          if (admin.type === 'User') {
            await createNotification({
              userId: admin.id,
              type: 'pending_user',
              title: 'Novi zahtjev za registraciju',
              message: `${ime} ${prezime} je poslao/la zahtjev za registraciju u vašu glazbenu školu.`,
              isPublic: false
            });
          } else if (admin.type === 'Mentor') {
            await createNotification({
              mentorId: admin.id,
              type: 'pending_user',
              title: 'Novi zahtjev za registraciju',
              message: `${ime} ${prezime} je poslao/la zahtjev za registraciju u vašu glazbenu školu.`,
              isPublic: false
            });
          }
        } catch (error) {
          console.error(`Error sending notification to admin ${admin.id} (${admin.type}):`, error);
        }
      }
    } catch (notificationError) {
      console.error('Error sending admin notification for pending user:', notificationError);
      // Don't fail the signup if notification fails
    }

    // Send emails: to admin inbox and acknowledgment to user
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.EMAIL_USER || 'leonosobni@gmail.com',
          pass: process.env.EMAIL_PASS,
        },
        secureOptions: 'TLSv1_2',
      });

      // Admin email
      const school = await School.findByPk(schoolId, { attributes: ['name'] });
      const adminMail = {
        from: process.env.EMAIL_USER,
        to: 'leonosobni@gmail.com',
        subject: 'Novi zahtjev za registraciju (Cadenza)',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color: rgb(252, 163, 17);">Novi zahtjev za registraciju</h2>
            <p><strong>Ime i prezime:</strong> ${ime} ${prezime}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Škola:</strong> ${school?.name || schoolId}</p>
            ${programId ? `<p><strong>Program ID:</strong> ${programId}</p>` : ''}
            ${pohadjaTeoriju ? `<p><strong>Pohađa teoriju:</strong> Da</p>` : ''}
            ${oib ? `<p><strong>OIB:</strong> ${oib}</p>` : ''}
            ${brojMobitela ? `<p><strong>Broj mobitela:</strong> ${brojMobitela}</p>` : ''}
            <p style="margin-top:12px;">Za odobravanje ili odbijanje, otvorite Administracija → Zahtjevi za registraciju.</p>
          </div>
        `
      };

      // User acknowledgment
      const userMail = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Vaša prijava je zaprimljena - Cadenza',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
            <div style="text-align: center;">
              <img src="https://cadenza.com.hr/logo512.png" alt="MAI - Cadenza Logo" style="max-width: 120px;" />
              <h2 style="color: rgb(252, 163, 17);">Prijava zaprimljena</h2>
            </div>
            <p>Poštovani ${ime} ${prezime},</p>
            <p>Vaša prijava za upis u glazbenu školu je uspješno zaprimljena. Nakon provjere od strane škole, dobit ćete email s podacima za prijavu.</p>
            <p>Ovaj postupak obično traje par dana.</p>
            <p style="margin-top:16px;">Za sva pitanja: <a href="mailto:app.info.cadenza@gmail.com">app.info.cadenza@gmail.com</a></p>
            <p>S poštovanjem,<br/>MAI - Cadenza</p>
          </div>
        `
      };

      await Promise.all([
        transporter.sendMail(adminMail).catch(e => console.error('Error sending admin pending email:', e)),
        transporter.sendMail(userMail).catch(e => console.error('Error sending user pending email:', e))
      ]);
    } catch (mailError) {
      console.error('Pending signup mail error:', mailError);
      // Do not fail request if email sending fails
    }

    res.status(201).json({
      message: 'Zahtjev za registraciju je uspješno poslan.',
      id: created.id
    });
  } catch (error) {
    console.error('Error creating pending user:', error);
    res.status(500).json({ message: 'Greška pri stvaranju zahtjeva za registraciju.' });
  }
});

// Admin routes for managing pending users
router.get('/admin/pending-users', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Pristup zabranjen. Potrebna admin prava.' });
    }

    const pendingUsers = await PendingUser.findAll({
      where: {
        status: 'pending',
        schoolId: req.user.schoolId // Filter by admin's school
      },
      include: [{
        model: Program,
        as: 'program'
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(pendingUsers);
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({ message: 'Greška pri dohvaćanju zahtjeva za registraciju.' });
  }
});

router.post('/admin/pending-users/:id/approve', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Pristup zabranjen. Potrebna admin prava.' });
    }

    const pendingUser = await PendingUser.findByPk(req.params.id);

    if (!pendingUser) {
      return res.status(404).json({ message: 'Zahtjev za registraciju nije pronađen.' });
    }

    // Just update the status to approved
    await pendingUser.update({ status: 'approved' });
    res.json({ message: 'Zahtjev za registraciju je odobren.' });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ message: 'Greška pri odobravanju korisnika.' });
  }
});

router.post('/admin/pending-users/:id/decline', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Pristup zabranjen. Potrebna admin prava.' });
    }

    const pendingUser = await PendingUser.findByPk(req.params.id);

    if (!pendingUser) {
      return res.status(404).json({ message: 'Zahtjev za registraciju nije pronađen.' });
    }

    await pendingUser.update({ status: 'declined' });
    res.json({ message: 'Zahtjev za registraciju je odbijen.' });
  } catch (error) {
    console.error('Error declining user:', error);
    res.status(500).json({ message: 'Greška pri odbijanju zahtjeva.' });
  }
});

// Cleanup route for removing old requests (can be called by a cron job)
router.delete('/admin/pending-users/cleanup', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Pristup zabranjen. Potrebna admin prava.' });
    }

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const result = await PendingUser.destroy({
      where: {
        createdAt: {
          [Op.lt]: twoWeeksAgo
        },
        status: 'pending'
      }
    });

    res.json({
      message: `Cleaned up ${result} old pending user requests`,
      count: result
    });
  } catch (error) {
    console.error('Error cleaning up pending users:', error);
    res.status(500).json({ message: 'Greška pri čišćenju starih zahtjeva.' });
  }
});

// Send notifications for existing pending users (retroactive)
router.post('/admin/pending-users/send-notifications', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Pristup zabranjen. Potrebna admin prava.' });
    }

    // Get all pending users for this admin's school
    const pendingUsers = await PendingUser.findAll({
      where: {
        status: 'pending',
        schoolId: req.user.schoolId
      },
      attributes: ['id', 'ime', 'prezime', 'schoolId', 'createdAt']
    });

    if (pendingUsers.length === 0) {
      return res.json({
        message: 'Nema zahtjeva za registraciju koji trebaju notifikacije.',
        count: 0
      });
    }

    // Find all admins for this school (both Users and Mentors)
    const userAdmins = await User.findAll({
      where: {
        schoolId: req.user.schoolId,
        isAdmin: true,
        fcmToken: { [Op.ne]: null }
      },
      attributes: ['id', 'fcmToken', 'ime', 'prezime']
    });

    const mentorAdmins = await Mentor.findAll({
      where: {
        schoolId: req.user.schoolId,
        isAdmin: true,
        fcmToken: { [Op.ne]: null }
      },
      attributes: ['id', 'fcmToken', 'ime', 'prezime']
    });

    const allAdmins = [
      ...userAdmins.map(admin => ({ ...admin.toJSON(), type: 'User' })),
      ...mentorAdmins.map(admin => ({ ...admin.toJSON(), type: 'Mentor' }))
    ];

    console.log(`Found ${allAdmins.length} school admins with FCM tokens:`, allAdmins.map(admin => ({ id: admin.id, type: admin.type, fcmToken: admin.fcmToken?.substring(0, 20) + '...' })));

    let notificationCount = 0;

    // Send notifications for each pending user
    for (const pendingUser of pendingUsers) {
      try {
                 // Send individual notifications to each admin
         for (const admin of allAdmins) {
           try {
             if (admin.type === 'User') {
               await createNotification({
                 userId: admin.id,
                 type: 'pending_user',
                 title: 'Novi zahtjev za registraciju',
                 message: `${pendingUser.ime} ${pendingUser.prezime} je poslao/la zahtjev za registraciju u vašu glazbenu školu.`,
                 isPublic: false
               });
             } else if (admin.type === 'Mentor') {
               await createNotification({
                 mentorId: admin.id,
                 type: 'pending_user',
                 title: 'Novi zahtjev za registraciju',
                 message: `${pendingUser.ime} ${pendingUser.prezime} je poslao/la zahtjev za registraciju u vašu glazbenu školu.`,
                 isPublic: false
               });
             }
             notificationCount++;
           } catch (error) {
             console.error(`Error sending notification to admin ${admin.id} (${admin.type}):`, error);
           }
         }
      } catch (notificationError) {
        console.error(`Error sending notification for pending user ${pendingUser.id}:`, notificationError);
        // Continue with other users even if one fails
      }
    }

         res.json({
       message: `Uspješno poslane notifikacije za ${pendingUsers.length} zahtjeva za registraciju.`,
       pendingUsersCount: pendingUsers.length,
       notificationsSent: notificationCount,
       adminsNotified: allAdmins.length
     });

  } catch (error) {
    console.error('Error sending retroactive notifications:', error);
    res.status(500).json({ message: 'Greška pri slanju notifikacija.' });
  }
});

// Public route for getting schools list (no auth required)
router.get('/schools/public', async (req, res) => {
  try {
    const schools = await School.findAll({
      attributes: ['id', 'name'],
      where: { active: true },
      order: [['name', 'ASC']]
    });
    res.json(schools);
  } catch (error) {
    console.error('Error fetching schools:', error);
    res.status(500).json({ message: 'Greška pri dohvaćanju škola.' });
  }
});

// Public route for getting program list by school (no auth required)
router.get('/programs/public/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;

    if (!schoolId) {
      return res.status(400).json({ message: 'Potrebno je odabrati školu.' });
    }

    const programs = await Program.findAll({
      where: {
        schoolId: schoolId,
        active: true,
        showInSignup: true
      },
      attributes: ['id', 'naziv', 'tipovi'],
      order: [['naziv', 'ASC']]
    });
    res.json(programs);
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ message: 'Greška pri dohvaćanju programa.' });
  }
});

module.exports = router;