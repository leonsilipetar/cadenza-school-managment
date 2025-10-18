const { User, School, Program, InvoiceSettings } = require('../models');
const { Enrollment, Mentor, sequelize } = require('../models');
const { generateEnrollmentConfirmationPDF, generateEnrollmentConfirmationPDFMulti } = require('../utils/pdfGenerator');

exports.generateEnrollmentConfirmation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserSchoolId = req.user?.schoolId;

    const user = await User.findByPk(userId, {
      include: [
        { model: School, as: 'school' },
        { model: Program, as: 'programs', through: { attributes: [] } }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Optional: enforce same school access
    if (currentUserSchoolId && user.schoolId && currentUserSchoolId !== user.schoolId) {
      return res.status(403).json({ message: 'Unauthorized for this user' });
    }

    // Match invoice generator behavior: prefer student's schoolId, fallback to requester
    const schoolIdForSettings = user.schoolId || req.user?.schoolId || user.school?.id || null;
    const invoiceSettings = schoolIdForSettings
      ? await InvoiceSettings.findOne({ where: { schoolId: schoolIdForSettings } })
      : null;

    // Fetch enrollment for current enrollment school year to get agreementAcceptedAt
    const enrollment = await Enrollment.findOne({
      where: { userId: user.id, schoolYear: getEnrollmentSchoolYear() },
      order: [['agreementAcceptedAt', 'DESC']]
    });

    const pdfBuffer = await generateEnrollmentConfirmationPDF(
      user.toJSON(),
      invoiceSettings ? invoiceSettings.toJSON() : null,
      enrollment ? enrollment.toJSON() : null
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="potvrda-upisa-${user.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating enrollment confirmation:', error);
    return res.status(500).json({ message: 'Error generating enrollment confirmation' });
  }
};

// Student: Generate own enrollment confirmation PDF (no userId param needed)
exports.generateMyEnrollmentConfirmation = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findByPk(userId, {
      include: [
        { model: School, as: 'school' },
        { model: Program, as: 'programs', through: { attributes: [] } }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prefer user's school settings, fallback to token schoolId, then related school
    const schoolIdForSettings = user.schoolId || req.user?.schoolId || user.school?.id || null;
    const invoiceSettings = schoolIdForSettings
      ? await InvoiceSettings.findOne({ where: { schoolId: schoolIdForSettings } })
      : null;

    // Fetch enrollment for current enrollment school year to get agreementAcceptedAt
    const enrollment = await Enrollment.findOne({
      where: { userId: user.id, schoolYear: getEnrollmentSchoolYear() },
      order: [['agreementAcceptedAt', 'DESC']]
    });

    const pdfBuffer = await generateEnrollmentConfirmationPDF(
      user.toJSON(),
      invoiceSettings ? invoiceSettings.toJSON() : null,
      enrollment ? enrollment.toJSON() : null
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="potvrda-upisa-${user.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating own enrollment confirmation:', error);
    return res.status(500).json({ message: 'Error generating enrollment confirmation' });
  }
};

// Generate a single PDF containing multiple confirmations for a list of userIds
exports.generateEnrollmentConfirmationBulk = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }

    // Resolve schoolId for settings from requester as a default
    const requesterSchoolId = req.user?.schoolId || null;

    // Load entries
    const entries = [];
    for (const uid of userIds) {
      const user = await User.findByPk(uid, {
        include: [
          { model: School, as: 'school' },
          { model: Program, as: 'programs', through: { attributes: [] } }
        ]
      });
      if (!user) continue;
      const schoolIdForSettings = user.schoolId || requesterSchoolId || user.school?.id || null;
      const invoiceSettings = schoolIdForSettings
        ? await InvoiceSettings.findOne({ where: { schoolId: schoolIdForSettings } })
        : null;
      const enrollment = await Enrollment.findOne({
        where: { userId: user.id, schoolYear: getEnrollmentSchoolYear() },
        order: [['agreementAcceptedAt', 'DESC']]
      });
      entries.push({ user: user.toJSON(), invoiceSettings: invoiceSettings ? invoiceSettings.toJSON() : null, enrollment: enrollment ? enrollment.toJSON() : null });
    }

    if (entries.length === 0) {
      return res.status(404).json({ message: 'No valid users found' });
    }

    const buffer = await generateEnrollmentConfirmationPDFMulti(entries);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="potvrde-upisa-${Date.now()}.pdf"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating bulk enrollment confirmations:', error);
    return res.status(500).json({ message: 'Error generating bulk enrollment confirmations' });
  }
};

const { Op } = require('sequelize');
const asyncWrapper = require('../middleware/asyncWrapper');

// Helper to get current school year (e.g. '2024/2025')
function getCurrentSchoolYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // School year typically starts in September (month 9)
  // If we're in months 9-12, we're in the current year's school year
  // If we're in months 1-8, we're in the previous year's school year
  let schoolYear;
  if (month >= 9) {
    // September onwards: current year / next year
    schoolYear = `${year}/${year + 1}`;
  } else {
    // January to August: previous year / current year
    schoolYear = `${year - 1}/${year}`;
  }

  return schoolYear;
}

// Helper to get enrollment school year (for enrollment checking)
function getEnrollmentSchoolYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // For enrollment purposes:
  // - Months 6-8 (June-August): Check enrollment for upcoming school year
  // - Months 9-12 (September-December): Check enrollment for current school year
  // - Months 1-5 (January-May): Check enrollment for current school year
  let schoolYear;
  if (month >= 6 && month <= 8) {
    // June-August: Check enrollment for upcoming school year
    schoolYear = `${year}/${year + 1}`;
  } else {
    // September-May: Check enrollment for current school year
    if (month >= 9) {
      schoolYear = `${year}/${year + 1}`;
    } else {
      schoolYear = `${year - 1}/${year}`;
    }
  }

  return schoolYear;
}

// 1. Get current user's enrollment for the current year
exports.getCurrentEnrollment = asyncWrapper(async (req, res) => {

  const userId = req.user.id;
  const schoolYear = getEnrollmentSchoolYear();

  try {
    const enrollment = await Enrollment.findOne({
      where: { userId, schoolYear },
      include: [
        { model: School, as: 'school' },
        { model: Program, as: 'program' },
        { model: Mentor, as: 'mentor' }
      ]
    });

    res.json({ enrollment, schoolYear });
  } catch (error) {
    console.error('📋 Error in getCurrentEnrollment:', error);
    throw error;
  }
});

// Get enrollment statistics for admin dashboard
exports.getEnrollmentStats = asyncWrapper(async (req, res) => {
  try {
    const { schoolId } = req.query;
    const schoolYear = getCurrentSchoolYear();

    // Build where clause based on schoolId
    const whereClause = { schoolYear };
    if (schoolId) {
      whereClause.schoolId = schoolId;
    }

    // Get active enrollments (accepted and active)
    const activeEnrollments = await Enrollment.count({
      where: {
        ...whereClause,
        agreementAccepted: true,
        active: true
      }
    });

    // Get pending enrollments (not yet accepted)
    const pendingEnrollments = await Enrollment.count({
      where: {
        ...whereClause,
        agreementAccepted: false
      }
    });

    res.json({
      activeEnrollments,
      pendingEnrollments,
      schoolYear
    });
  } catch (error) {
    console.error('Error fetching enrollment stats:', error);
    throw error;
  }
});

// 2. Accept/confirm enrollment for the current year
exports.acceptEnrollment = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const schoolYear = getEnrollmentSchoolYear();
  const agreementText = req.body.agreementText || '';
  const requestedProgramId = req.body.programId; // Get programId from request body

  // Resolve schoolId strictly from the authenticated user (DB/token). Do not accept from request body or program.
  let dbUser = null;
  let effectiveSchoolId = req.user?.schoolId || null;
  if (!effectiveSchoolId) {
    dbUser = await User.findByPk(userId, { include: [{ model: School, as: 'school' }, { model: Program, as: 'programs' }] });
    effectiveSchoolId = dbUser?.schoolId || dbUser?.school?.id || 1;
  }
  if (!effectiveSchoolId) {
    // Fallback to main school if still not resolved
    effectiveSchoolId = 1;
  }

  // If program is provided, validate it belongs to the user's school
  let requestedProgram = null;
  if (requestedProgramId) {
    requestedProgram = await Program.findByPk(requestedProgramId);
    if (!requestedProgram) {
      return res.status(400).json({ success: false, message: 'Selected program not found' });
    }
    if (String(effectiveSchoolId) !== String(requestedProgram.schoolId)) {
      return res.status(400).json({ success: false, message: 'Invalid program selected or program does not belong to your school' });
    }
  }

  // Robustno dohvaćanje programId i mentorId
  let programId = null;

  // Priority: 1. Requested programId, 2. User's current program, 3. User's programs array (token), 4. DB user's programs
  if (requestedProgramId) {
    // At this point requestedProgram is loaded and effectiveSchoolId aligned
    programId = requestedProgramId;
  } else if (req.user.programId) {
    programId = req.user.programId;
  } else if (Array.isArray(req.user.programs) && req.user.programs.length > 0) {
    programId = req.user.programs[0].id;
  } else if (!programId && !dbUser) {
    // As a last resort, fetch from DB if not already loaded
    dbUser = await User.findByPk(userId, { include: [{ model: Program, as: 'programs' }] });
    if (Array.isArray(dbUser?.programs) && dbUser.programs.length > 0) {
      programId = dbUser.programs[0].id;
    }
  }

  // effectiveSchoolId is already validated above; do not modify it based on program or previous enrollment

  let mentorId = null;
  if (Array.isArray(req.user.mentorId) && req.user.mentorId.length > 0) {
    mentorId = req.user.mentorId[0];
  } else if (typeof req.user.mentorId === 'number') {
    mentorId = req.user.mentorId;
  }

  // Use database transaction to prevent race conditions
  const result = await sequelize.transaction(async (t) => {
    // Ensure user's school is set (fallback to 1 if missing)
    const userRecord = await User.findByPk(userId, { transaction: t });
    if (userRecord && !userRecord.schoolId) {
      await userRecord.update({ schoolId: effectiveSchoolId || 1 }, { transaction: t });
    }

    // Persist selected program to the user's programs and programType
    if (programId && userRecord && typeof userRecord.setPrograms === 'function') {
      await userRecord.setPrograms([programId], { transaction: t });
      if (req.body.pohadanjeNastave) {
        const existingTypes = (userRecord.programType && typeof userRecord.programType === 'object') ? userRecord.programType : {};
        const mergedTypes = { ...existingTypes, [programId]: req.body.pohadanjeNastave };
        await userRecord.update({ programType: mergedTypes }, { transaction: t });
      }
    }
    // Check if enrollment already exists with pessimistic locking
    let enrollment = await Enrollment.findOne({
      where: { userId, schoolYear },
      lock: t.LOCK.UPDATE,
      transaction: t
    });

    if (!enrollment) {
      // Create new enrollment if not exists
      enrollment = await Enrollment.create({
        userId,
        schoolId: effectiveSchoolId,
        programId: programId || null,
        mentorId: mentorId || null,
        schoolYear,
        agreementAccepted: true,
        agreementAcceptedAt: new Date(),
        agreementTextSnapshot: agreementText,
        active: true
      }, { transaction: t });
    } else if (!enrollment.agreementAccepted) {
      // Update existing enrollment only if not already accepted
      enrollment.agreementAccepted = true;
      enrollment.agreementAcceptedAt = new Date();
      enrollment.agreementTextSnapshot = agreementText;
      enrollment.active = true;
      await enrollment.save({ transaction: t });
    } else {
      // Enrollment already accepted - return existing data
      return { success: true, enrollment, alreadyAccepted: true };
    }

    return { success: true, enrollment, alreadyAccepted: false };
  });

  res.json(result);
});

// 3. Admin: List/filter enrollments for a school year
exports.listEnrollments = asyncWrapper(async (req, res) => {

  const { schoolYear, active, search, schoolId } = req.query;
  // Use the provided schoolYear or default to current school year
  const targetYear = schoolYear || getCurrentSchoolYear();

  try {
    // Build where clause
    const whereClause = {
      schoolYear: targetYear,
      ...(active !== undefined && { active: active === 'true' })
    };

    // Add school filtering if schoolId is provided
    if (schoolId) {
      whereClause.schoolId = schoolId;
    }

    // Get enrollments with filtering
    const enrollments = await Enrollment.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user' },
        { model: School, as: 'school' },
        { model: Program, as: 'program' },
        { model: Mentor, as: 'mentor' }
      ]
    });

    res.json({ enrollments });
  } catch (error) {
    console.error('📋 Error in listEnrollments:', error);
    throw error;
  }
});

// 4. Get agreement text (static or from DB)
exports.getAgreementText = asyncWrapper(async (req, res) => {
  // For now, return a static agreement text. You can load from DB or file if needed.
  const agreementText = `
    <h2>Ugovor i Suglasnost</h2>
    <p>Prihvaćanjem ove suglasnosti potvrđujete upis u školsku godinu i prihvaćate sve uvjete.</p>
    <ul>
      <li>Podaci su točni i potpuni.</li>
      <li>Prihvaćate pravila škole i GDPR uvjete.</li>
      <li>Ova potvrda ima pravnu snagu.</li>
    </ul>
  `;
  res.json({ agreementText });
});