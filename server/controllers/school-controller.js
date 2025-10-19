const { School, Mentor, User } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Get all schools
const getSchools = async (req, res) => {
  try {
    const schools = await School.findAll();
    res.status(200).json(schools);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// Get school by ID
const getSchoolById = async (req, res) => {
  try {
    const school = await School.findByPk(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    res.status(200).json(school);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// Create school (protected - admin only)
const createSchool = async (req, res) => {
  try {
    const school = await School.create(req.body);
    res.status(201).json(school);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// Update school
const updateSchool = async (req, res) => {
  try {
    const school = await School.findByPk(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    await school.update(req.body);
    res.status(200).json(school);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// Delete school
const deleteSchool = async (req, res) => {
  try {
    const school = await School.findByPk(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    await school.destroy();
    res.status(200).json({ message: 'School deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// Get school stats
const getSchoolStats = async (req, res) => {
  try {
    const school = await School.findByPk(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const studentCount = await User.count({ where: { schoolId: req.params.id, isStudent: true } });
    const mentorCount = await Mentor.count({ where: { schoolId: req.params.id } });

    res.status(200).json({
      school,
      stats: {
        students: studentCount,
        mentors: mentorCount
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// PUBLIC ENDPOINT: Register a new school with admin mentor
const registerSchool = async (req, res) => {
  const transaction = await School.sequelize.transaction();
  
  try {
    const {
      // School data
      schoolName,
      street,
      location,
      kontaktInfo,
      webOpis,
      
      // Admin/Mentor data
      ime,
      prezime,
      email,
      password,
      brojMobitela,
      oib
    } = req.body;

    // Validation
    if (!schoolName || !ime || !prezime || !email || !password) {
      return res.status(400).json({ 
        message: 'Obavezna polja: Naziv škole, ime, prezime, email i lozinka' 
      });
    }

    // Check if email already exists
    const existingMentor = await Mentor.findOne({ where: { email } });
    if (existingMentor) {
      return res.status(400).json({ message: 'Email već postoji u sustavu' });
    }

    // Create school
    const school = await School.create({
      name: schoolName,
      street: street || null,
      location: location || null,
      active: true, // Schools are active by default
      kontaktInfo: kontaktInfo || {
        telefon: brojMobitela || null,
        email: email || null,
        facebook: null,
        instagram: null,
        youtube: null
      },
      webOpis: webOpis || null,
      webEnabled: false, // Can be enabled later by school admin
      driveEnabled: false
    }, { transaction });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin mentor for the school
    const mentor = await Mentor.create({
      korisnickoIme: email, // Using email as username
      email,
      password: hashedPassword,
      ime,
      prezime,
      oib: oib || null,
      brojMobitela: brojMobitela || null,
      isAdmin: true, // This is the school admin
      isMentor: true,
      isStudent: false,
      schoolId: school.id,
      showOnWeb: false // School admin doesn't need to be on website by default
    }, { transaction });

    await transaction.commit();

    // Generate JWT token for immediate login
    const token = jwt.sign(
      { id: mentor.id, isMentor: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Škola i admin račun uspješno kreirani!',
      school: {
        id: school.id,
        name: school.name,
        location: school.location
      },
      mentor: {
        id: mentor.id,
        ime: mentor.ime,
        prezime: mentor.prezime,
        email: mentor.email,
        isAdmin: mentor.isAdmin
      },
      token // Auto-login token
    });

  } catch (err) {
    await transaction.rollback();
    console.error('School registration error:', err);
    res.status(500).json({ 
      message: 'Greška pri registraciji škole', 
      error: err.message 
    });
  }
};

module.exports = {
  getSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
  getSchoolStats,
  registerSchool // NEW PUBLIC ENDPOINT
};
