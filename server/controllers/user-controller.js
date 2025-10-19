const { User, Mentor, Program, Invoice, Chat, Raspored, RasporedTeorija, School, Enrollment, sequelize } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const asyncWrapper = require('../middleware/asyncWrapper')
const { Op } = require('sequelize');
const nodemailer = require('nodemailer')
const xss = require('xss');
const ExcelJS = require('exceljs');

// Helper function to ensure chat connection exists between student and mentor
const ensureChatConnection = async (studentId, mentorId, transaction) => {
  try {
    // Check if chat already exists (either direction)
    const existingChat = await Chat.findOne({
      where: {
        [Op.or]: [
          {
            participant1Id: studentId,
            participant1Type: 'student',
            participant2Id: mentorId,
            participant2Type: 'mentor'
          },
          {
            participant1Id: mentorId,
            participant1Type: 'mentor',
            participant2Id: studentId,
            participant2Type: 'student'
          }
        ]
      },
      transaction
    });

    if (!existingChat) {
      // Create new chat connection
      await Chat.create({
        participant1Id: studentId,
        participant1Type: 'student',
        participant2Id: mentorId,
        participant2Type: 'mentor',
        lastMessageAt: null,
        lastMessageText: null,
        unreadCount1: 0,
        unreadCount2: 0
      }, { transaction });
      console.log(`Created chat connection between student ${studentId} and mentor ${mentorId}`);
    }
  } catch (error) {
    console.error('Error ensuring chat connection:', error);
    // Don't throw error - chat creation failure shouldn't block user update
  }
};

// Validation constants
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const NAME_MAX_LENGTH = 50;
const ADDRESS_MAX_LENGTH = 200;
const PHONE_MAX_LENGTH = 20;
const OIB_LENGTH = 11;
const NOTES_MAX_LENGTH = 1000;

const MAX_USERS_PER_EMAIL = 5; // Define your desired limit here

// Input validation helper
const validateInput = (input, fieldName, minLength, maxLength, required = true) => {
  // If missing
  if (input === null || input === undefined) {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return input;
  }

  // Preserve objects/arrays as-is (used for JSON fields like address/parents)
  if (typeof input === 'object') {
    return input;
  }

  // Convert non-string primitives to string
  const inputStr = typeof input === 'string' ? input : String(input);

  if (required && (!inputStr || (typeof inputStr === 'string' && !inputStr.trim()))) {
    throw new Error(`${fieldName} is required`);
  }
  if (inputStr && typeof inputStr === 'string' && inputStr.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters long`);
  }
  if (inputStr && typeof inputStr === 'string' && inputStr.length > maxLength) {
    throw new Error(`${fieldName} cannot be longer than ${maxLength} characters`);
  }

  // Only trim if it's a string, otherwise return the original value
  return typeof inputStr === 'string' ? xss(inputStr.trim()) : inputStr;
};

// Username generation helper (ensure this is robust)
const generateUsername = async (ime, prezime) => {
  const cleanName = ime.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  const cleanSurname = prezime.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  let baseUsername = `${cleanName}.${cleanSurname}`;
  if (!cleanName || !cleanSurname) { // Handle cases where name or surname might be empty or non-alphanumeric
    baseUsername = `user${Date.now().toString().slice(-6)}`; // Fallback username
  }
  let username = baseUsername;
  let counter = 1;
  while (true) {
    const existingUser = await User.findOne({ where: { korisnickoIme: username } });
    if (!existingUser) {
      return username;
    }
    username = `${baseUsername}${counter}`;
    counter++;
    if (counter > 100) { // Safety break for extreme cases
        username = `${baseUsername}${Date.now().toString().slice(-4)}${counter}`;
        // Potentially throw an error if still can't generate unique username after many tries
        // For now, this adds more randomness if simple counter fails extensively.
    }
  }
};

// Signup
const signup = async (req, res) => {
  try {
    const {
      email,
      ime,
      prezime,
      brojMobitela,
      adresa,
      oib,
      datumRodjenja,
      pohadjaTeoriju,
      customAttributes,
      maloljetniClan,
      roditelj1,
      roditelj2,
      schoolId,
      programId,
      napomene
    } = req.body;

    const korisnickoIme = await generateUsername(ime, prezime);
    const sanitizedEmail = validateInput(email, 'Email', 5, 100);
    const sanitizedFirstName = validateInput(ime, 'First name', 1, NAME_MAX_LENGTH);
    const sanitizedLastName = validateInput(prezime, 'Last name', 1, NAME_MAX_LENGTH);

    // Validate optional fields
    const sanitizedAddress = adresa ? validateInput(adresa, 'Address', 1, ADDRESS_MAX_LENGTH, false) : null;
    const sanitizedPhone = brojMobitela ? validateInput(brojMobitela, 'Phone number', 1, PHONE_MAX_LENGTH, false) : null;
    // Normalize notes to array of strings and sanitize each entry
    const notesArray = Array.isArray(napomene)
      ? napomene
      : (typeof napomene === 'string' && napomene.trim() ? [napomene] : []);
    const sanitizedNotesArray = notesArray
      .map(n => xss(String(n).trim()))
      .filter(n => n.length > 0 && n.length <= NOTES_MAX_LENGTH);

    // Validate OIB format
    if (oib && (!/^\d{11}$/.test(oib))) {
      throw new Error('OIB must be exactly 11 digits');
    }

    // Validate email format
    const emailRegex = /^[\w\.-]+@[\w\.-]+\.\w+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      throw new Error('Invalid email format');
    }

    // Check how many users already exist with this email (allow duplicates up to limit)
    const existingUsersWithEmailCount = await User.count({ where: { email: sanitizedEmail } });

    if (existingUsersWithEmailCount >= MAX_USERS_PER_EMAIL) {
      return res.status(400).json({
        message: `Prekoračen maksimalni broj korisnika (${MAX_USERS_PER_EMAIL}) za email adresu: ${sanitizedEmail}. Molimo kontaktirajte administratora.`,
        errorText: `Email usage limit exceeded for ${sanitizedEmail}`
      });
    }

    const passwordLength = 8;
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomPassword = Array.from({ length: passwordLength }, () =>
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).join('');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const user = await sequelize.transaction(async (t) => {
      // Allow multiple users per same email up to MAX_USERS_PER_EMAIL; do not block creation
      const newUser = await User.create({
        email: sanitizedEmail,
        password: hashedPassword,
        ime: sanitizedFirstName,
        prezime: sanitizedLastName,
        isAdmin: false,
        isMentor: false,
        isStudent: true,
        korisnickoIme,
        brojMobitela: sanitizedPhone,
        oib,
        datumRodjenja,
        adresa: sanitizedAddress,
        roditelj1,
        roditelj2,
        pohadjaTeoriju: pohadjaTeoriju || false,
        customAttributes: customAttributes || {},
        napomene: sanitizedNotesArray,
        maloljetniClan: maloljetniClan || false,
        schoolId: schoolId || 1,
        mentorId: [],
        racuni: [],
        programType: null
      }, { transaction: t });

      if (schoolId) {
        const school = await School.findByPk(schoolId, { transaction: t });
        if (school) await newUser.setSchool(school, { transaction: t });
      }

      if (programId) {
        if (Array.isArray(programId) && programId.length > 0) {
          const programs = await Program.findAll({ where: { id: programId }, transaction: t });
          if (programs.length > 0) await newUser.setPrograms(programs, { transaction: t });
        } else if (!Array.isArray(programId)) {
          const program = await Program.findByPk(programId, { transaction: t });
          if (program) await newUser.addProgram(program, { transaction: t });
        }
      }
      return newUser;
    });

    const userWithAssociations = await User.findByPk(user.id, {
      include: [
        { model: School, as: 'school' },
        { model: Program, as: 'programs' }
      ]
    });

    await sendPasswordEmail(sanitizedEmail, randomPassword, korisnickoIme);

    res.status(201).json({
      message: 'Korisnik uspješno kreiran.',
      user: userWithAssociations
    });

  } catch (error) {
    console.error('Error during signup:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      // Map specific unique constraint fields to clearer messages
      const fields = (error.fields && Object.keys(error.fields)) || [];
      if (fields.includes('email')) {
        return res.status(400).json({
          message: 'Korisnik s ovom email adresom već postoji.',
          errorText: 'Email already exists'
        });
      }
      if (fields.includes('oib')) {
        return res.status(400).json({
          message: 'Korisnik s ovim OIB-om već postoji.',
          errorText: 'OIB already exists'
        });
      }
      if (fields.includes('korisnickoIme')) {
        return res.status(400).json({
          message: error.errors?.[0]?.message || 'Korisničko ime već postoji.',
          errorText: error.errors?.[0]?.message || 'Username already exists'
        });
      }
    }
    res.status(500).json({
      message: 'Greška prilikom registracije.',
      errorText: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    // Accept either emailOrUsername (preferred) or email (legacy)
    const { emailOrUsername, email, password } = req.body;
    const loginCredential = (typeof emailOrUsername === 'string' ? emailOrUsername : email).trim();
    console.log('🔐 Login attempt with credential:', loginCredential);

    // First check User table
    let user = await User.findOne({
      where: {
        [Op.or]: [
          { korisnickoIme: loginCredential },
          { email: loginCredential }
        ]
      },
      include: [
        { model: School, as: 'school' },
        { model: Program, as: 'programs' }
      ]
    });

    let userType = 'student';
    console.log('👤 User table search result:', user ? 'Found user' : 'No user found');

    // If not found in User table, check Mentor table
    if (!user) {
      console.log('🔍 Searching mentor with credential:', loginCredential);
      user = await Mentor.findOne({
        where: {
          [Op.or]: [
            { korisnickoIme: loginCredential },
            { email: loginCredential }
          ]
        },
        include: [
          { model: School, as: 'school' },
          { model: Program, as: 'programs' }
        ]
      });
      if (user) {
        userType = 'mentor';
        console.log('✅ Found mentor:', { id: user.id, email: user.email, korisnickoIme: user.korisnickoIme });
      } else {
        console.log('❌ No mentor found with credential:', loginCredential);
      }
    }

    if (!user) {
      // If the login credential looks like an email and matches multiple accounts, ask for username
      const emailRegex = /^[\w\.-]+@[\w\.-]+\.[A-Za-z]{2,}$/;
      if (emailRegex.test(loginCredential)) {
        const count = await User.count({ where: { email: loginCredential } });
        if (count > 1) {
          return res.status(409).json({
            message: "Više korisnika koristi ovu e‑mail adresu. Prijavite se korisničkim imenom.",
            debug: "Multiple users share email"
          });
        }
      }
      return res.status(401).json({ message: "Nevažeći podaci za prijavu", debug: "Korisnik nije pronađen" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Nevažeći podaci za prijavu", debug: "Lozinka se ne podudara" });
    }

    // Generate token with proper user type info
    const tokenPayload = {
      id: user.id,
      isMentor: userType === 'mentor',
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    // Prepare user object for the response
    const userResponse = {
      id: user.id,
      ime: user.ime,
      prezime: user.prezime,
      email: user.email,
      korisnickoIme: user.korisnickoIme,
      isAdmin: user.isAdmin,
      isMentor: userType === 'mentor',
      isStudent: userType === 'student',
      school: user.school,
      programs: user.programs,
      profilePicture: user.profilePicture,
      reminderPreferences: user.reminderPreferences
    };

    res.status(200).json({
      message: "Uspješna prijava",
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Greška prilikom prijave" });
  }
};

// Verify Token - Modified to check both cookie and header
const verifyToken = async (req, res, next) => {
  try {
    // Check cookie first
    const tokenFromCookie = req.cookies.token;

    // Then check Authorization header
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];

    // Use cookie token if available, otherwise use header token
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
      console.log('No token found in cookie or header');
      return res.status(401).json({ message: "Access Denied: No token provided" });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified:', { id: verified.id, isMentor: verified.isMentor });

    let user;

    if (verified.isMentor) {
      user = await Mentor.findByPk(verified.id, {
        include: [
          { model: School, as: 'school', attributes: ['id', 'name'] },
          { model: Program, as: 'programs', attributes: ['id', 'naziv', 'tipovi', 'cijena'], through: { attributes: [] } }
        ]
      });
    } else {
      user = await User.findByPk(verified.id, {
        include: [
          { model: School, as: 'school', attributes: ['id', 'name'] },
          { model: Program, as: 'programs', attributes: ['id', 'naziv', 'tipovi', 'cijena'], through: { attributes: [] } }
        ]
      });
    }

    if (!user) {
      console.log('User not found for token:', verified.id);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.user = user;
    req.userId = user.id;
    req.isMentor = verified.isMentor;
    req.ime = user.ime;
    req.prezime = user.prezime;
    req.schoolId = user.schoolId;
    next();

  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid Token" });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token Expired" });
    }
    res.status(500).json({ message: "Server Error" });
  }
};


// Get User Details
const getUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // If verifyToken already hydrated the user with associations, reuse it
    if (req.user && (Array.isArray(req.user.programs) || req.user.school)) {
      return res.json({ user: req.user });
    }

    // First try to find in User table
    let user = await User.findByPk(userId, {
      include: [
        {
          model: School,
          as: 'school',
          attributes: ['id', 'name']
        },
        {
          model: Program,
          as: 'programs',
          attributes: ['id', 'naziv', 'tipovi', 'cijena'],
          through: { attributes: [] }
        }
      ]
    });

    // If not found in User table, try Mentor table
    if (!user) {
      user = await Mentor.findByPk(userId, {
        include: [
          {
            model: School,
            as: 'school',
            attributes: ['id', 'name']
          },
          {
            model: Program,
            as: 'programs',
            attributes: ['id', 'naziv', 'tipovi', 'cijena'],
            through: { attributes: [] }
          }
        ]
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If the user is a student, fetch their mentors
    if (user.isStudent && user.mentorId && user.mentorId.length > 0) {
      const mentors = await Mentor.findAll({
        where: {
          id: {
            [Op.in]: user.mentorId
          }
        },
        attributes: ['id', 'ime', 'prezime', 'email', 'schoolId']
      });

      // Add mentors to the user object
      user.dataValues.mentors = mentors;
    }

    // If the user is a mentor, fetch their students
    if (user.isMentor && user.studentId && user.studentId.length > 0) {
      const students = await User.findAll({
        where: {
          id: {
            [Op.in]: user.studentId
          }
        },
        attributes: ['id', 'ime', 'prezime', 'email', 'schoolId']
      });

      // Add students to the user object
      user.dataValues.students = students;
    }

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
};


// Refresh Token
const refreshToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(403).json({ message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid token' });
      }

      const newToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.status(200).json({ message: 'Token refreshed successfully', token: newToken });
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ message: 'Error refreshing token', error: error.message });
  }
};

// Logout
const logout = async (req, res) => {
  try {
      res.clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
          path: '/'
      });
      res.status(200).json({ message: "Successfully logged out" });
  } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: "Error logging out" });
  }
};

// Get Users
const getKorisnici = async (req, res) => {
  try {
    const { schoolId } = req.query;

    // If schoolId is provided, filter by it; otherwise, get all users
    const where = schoolId ? { schoolId } : {};

    const users = await User.findAll({
      where,
      include: [
        {
          model: Program,
          as: 'programs',
          through: { attributes: [] } // Exclude junction table attributes
        },
        {
          model: Enrollment,
          as: 'enrollments',
          attributes: ['agreementAccepted', 'active', 'schoolYear']
        }
      ]
    });

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// Get User Details by ID
const getDetaljiKorisnika = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findByPk(userId, {
      include: [
        {
          model: School,
          as: 'school'
        },
        {
          model: Program,
          as: 'programs',
          through: { attributes: [] } // Excludes junction table attributes
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      message: 'Error fetching user details',
      error: error.message
    });
  }
};

const getOsnovniDetaljiKorisnika = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findByPk(userId, {
      attributes: ['id', 'ime', 'prezime', 'profilePicture']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add hasProfilePicture flag based on whether profilePicture exists
    const hasProfilePicture = user.profilePicture !== null;

    res.json({
      user: {
        id: user.id,
        ime: user.ime,
        prezime: user.prezime,
        hasProfilePicture
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      message: 'Error fetching user details',
      error: error.message
    });
  }
};

// Update User Details
const updateDetaljiKorisnika = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('🔍 Updating user:', userId);
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('👤 Current user data:', {
      korisnickoIme: user.korisnickoIme,
      currentPrograms: user.programs?.length || 0,
      currentProgramType: user.programType
    });

    // Check if username is being changed and validate uniqueness
    if (req.body.korisnickoIme && req.body.korisnickoIme !== user.korisnickoIme) {
      console.log('🔄 Username change detected:', user.korisnickoIme, '->', req.body.korisnickoIme);
      const existingUser = await User.findOne({
        where: {
          korisnickoIme: req.body.korisnickoIme,
          id: { [Op.ne]: userId } // Exclude current user from uniqueness check
        }
      });

      if (existingUser) {
        console.log('❌ Username already exists:', req.body.korisnickoIme);
        return res.status(400).json({
          message: 'Korisničko ime već postoji',
          errorText: 'Username already exists'
        });
      }
    }

    await sequelize.transaction(async (t) => {
      try {
        // Prepare update data, excluding programs and programType as they're handled separately
        const updateData = { ...req.body };
        delete updateData.programs;
        delete updateData.programType;
        // Also remove programId here; we'll handle mapping to many-to-many below
        const incomingProgramId = updateData.programId;
        delete updateData.programId;

        console.log('📊 Update data (excluding programs):', JSON.stringify(updateData, null, 2));

        // Update user details. Preserve existing schoolId if not provided to avoid accidental wipe.
        await user.update({
          ...updateData,
          mentorId: Array.isArray(req.body.mentorId) ? req.body.mentorId : [],
          schoolId: (req.body.schoolId !== undefined) ? (req.body.schoolId || 1) : (user.schoolId || 1),
          programId: null  // Clear the old programId field since we're using the junction table
        }, { transaction: t });

        // Handle program updates
        if (req.body.programs && Array.isArray(req.body.programs)) {
          console.log('🎯 Setting programs:', req.body.programs);
          // Clear existing programs and set new ones
          await user.setPrograms(req.body.programs, { transaction: t });
          console.log('✅ Programs updated successfully');
        } else if (incomingProgramId) {
          // Accept single programId to set user's program(s)
          console.log('🎯 Setting single programId:', incomingProgramId);
          await user.setPrograms([incomingProgramId], { transaction: t });
          console.log('✅ Single program set successfully');
        } else {
          console.log('⚠️ No programs array or programId provided');
        }

        // Handle programType updates if provided
        if (req.body.programType && typeof req.body.programType === 'object') {
          console.log('🎨 Setting program types:', req.body.programType);
          await user.update({ programType: req.body.programType }, { transaction: t });
          console.log('✅ Program types updated successfully');
        } else {
          console.log('⚠️ No programType provided or invalid format');
        }

        // Sync mentors' student lists when student's mentorId changes (admin feature)
        const newMentorIds = Array.isArray(req.body.mentorId)
          ? req.body.mentorId
              .map(id => parseInt(id))
              .filter(id => !isNaN(id))
          : [];

        // Find mentors that currently include this student
        const mentorsWithThisStudent = await sequelize.models.Mentor.findAll({
          where: {
            studentId: { [Op.contains]: [userId] }
          },
          transaction: t
        });

        // Remove this student from mentors no longer selected
        for (const mentor of mentorsWithThisStudent) {
          if (!newMentorIds.includes(mentor.id)) {
            const updatedStudentIds = (mentor.studentId || []).filter(id => id !== userId);
            await mentor.update({ studentId: updatedStudentIds }, { transaction: t });
          }
        }

        // Add this student to newly selected mentors
        if (newMentorIds.length > 0) {
          const selectedMentors = await sequelize.models.Mentor.findAll({
            where: { id: { [Op.in]: newMentorIds } },
            transaction: t
          });
          for (const mentor of selectedMentors) {
            const currentIds = Array.isArray(mentor.studentId) ? mentor.studentId : [];
            if (!currentIds.includes(userId)) {
              await mentor.update({ studentId: [...currentIds, userId] }, { transaction: t });
            }
            // Ensure chat connection exists between student and mentor
            await ensureChatConnection(userId, mentor.id, t);
          }
        }
      } catch (transactionError) {
        console.error('❌ Transaction error:', transactionError);
        throw transactionError; // Re-throw to trigger rollback
      }
    });

    // Fetch updated user with associations
    const updatedUser = await User.findByPk(userId, {
      include: [
        {
          model: School,
          as: 'school'
        },
        {
          model: Program,
          as: 'programs',
          through: { attributes: [] }  // Exclude junction table attributes
        }
      ]
    });

    console.log('✅ User updated successfully. New programs count:', updatedUser.programs?.length || 0);

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('❌ Error updating user details:', error);

    // Handle specific Sequelize errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      if (error.fields && error.fields.korisnickoIme) {
        return res.status(400).json({
          message: 'Korisničko ime već postoji',
          errorText: 'Username already exists'
        });
      }
    }

    res.status(500).json({
      message: 'Error updating user details',
      error: error.message
    });
  }
};

// Get All Students
const getAllStudents = async (req, res) => {
  try {
    const students = await User.findAll({
      where: { isStudent: true },
      attributes: ['id', 'ime', 'prezime', 'isStudent', 'mentorId'],
      order: [['ime', 'ASC'], ['prezime', 'ASC']]
    });
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Error fetching students' });
  }
};

// Search Users and Mentors
const searchUsersAndMentors = async (req, res) => {
  try {
    const { searchTerm } = req.query;

    console.log('Search Term:', searchTerm);

    // Search for students
    const students = await User.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { ime: { [Op.iLike]: `%${searchTerm}%` } },
              { prezime: { [Op.iLike]: `%${searchTerm}%` } }
            ]
          },
          { schoolId: req.user.schoolId },
          { isStudent: true },
          { deletedAt: null }
        ]
      },
      attributes: ['id', 'ime', 'prezime', 'email', 'programType', 'isStudent']
    });

    // Search for mentors
    const mentors = await Mentor.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { ime: { [Op.iLike]: `%${searchTerm}%` } },
              { prezime: { [Op.iLike]: `%${searchTerm}%` } }
            ]
          },
          { schoolId: req.user.schoolId },
          { deletedAt: null }
        ]
      },
      attributes: ['id', 'ime', 'prezime', 'email', 'isStudent']
    });

    // Combine and send results
    const combinedResults = [...students, ...mentors];
    res.status(200).json(combinedResults);
  } catch (error) {
    console.error('Error searching users and mentors:', error);
    res.status(500).json({ message: 'Error searching users and mentors', error: error.message });
  }
};

// Get User Invoices
const getUserInvoices = async (req, res) => {
  try {
    const userId = req.params.userId;

    const foundUser = await User.findByPk(userId, {
      include: [{ model: Invoice, as: 'invoices' }]
    });

    if (!foundUser) {
      return res.status(404).send('User not found');
    }

    res.json(foundUser.invoices);
  } catch (error) {
    console.error('Error fetching user invoices:', error);
    res.status(500).send('Error fetching invoices');
  }
};

// Delete User
const deleteUser = async (req, res) => {
  const { id } = req.params;
  const { userType } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const Model = userType === 'student' ? User : Mentor;
    const user = await Model.findByPk(id);

    if (!user) {
      throw new Error('User not found');
    }

    // Instead of destroying, just update deletedAt
    await user.destroy({ transaction }); // This will now perform a soft delete

    // No need to delete related records since we're soft deleting
    await transaction.commit();

    res.status(200).json({ message: 'User successfully deactivated' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deactivating user:', error);
    res.status(500).json({
      message: 'Error deactivating user',
      error: error.message
    });
  }
};
const sendPasswordEmail = async (email, password, korisnickoIme) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    secureOptions: 'TLSv1_2',
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Dobrodošli u Cadenza platformu - Detalji vašeg računa',
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
      <!-- Header section with logo -->
      <div style="text-align: center;">
        <img src="https://cadenza.com.hr/logo512.png" alt="Cadenza Logo" style="max-width: 150px;" />
        <h1 style="color: rgb(252, 163, 17); font-size: 24px;">Dobrodošli na Cadenza platformu!</h1>
      </div>

      <!-- Email introduction -->
      <p>Poštovani,</p>
      <p>Radujemo se što vas možemo pozdraviti na Cadenza platformi. Vaš korisnički račun je uspješno stvoren, a ovdje su vaši podaci za prijavu:</p>

      <!-- Highlighted user details -->
      <div style="border: 1px solid #ddd; padding: 10px; background-color: #fff8e6; margin-bottom: 20px;">
        <p><strong>E-mail adresa:</strong> ${email}</p>
        <p><strong>Korisničko ime:</strong> ${korisnickoIme}</p>
        <p><strong>Lozinka:</strong> ${password}</p>
      </div>
      <div style="border: 1px solid #ddd; padding: 10px; background-color: #fff8e6; margin-bottom: 20px;">
        <p><strong>Za najbolje iskustvo korištenja preporučujemo prijavu preko Google Chrome preglednika te instaliranje aplikacije klikom na gumb instaliraj!</strong></p>
      </div>

      <!-- Call to action button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://cadenza.com.hr/login" style="
          background-color: rgb(252, 163, 17);
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          font-size: 16px;
          font-weight: bold;
          display: inline-block;
          transition: background-color 0.3s ease;
          ">Posjetite našu aplikaciju</a>
      </div>

       <!-- Support and closing -->
        <p>Molimo vas da čuvate ove informacije i ne dijelite lozinku. Ako imate bilo kakvih pitanja ili nedoumica, slobodno se obratite na adresu za podršku: <a href="mailto:app.info.cadenza@gmail.com">app.info.cadenza@gmail.com</a>.</p>

      <p>S poštovanjem,<br />Cadenza</p>
    </div>

    <!-- Styling for hover effect -->
    <style>
      a:hover {
        background-color: rgba(252, 163, 17, 0.8);
      }
    </style>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Send enrollment reminder email to users
const sendEnrollmentReminders = async (req, res) => {
  try {
    const { userIds, customMessage } = req.body || {};

    // Build base where clause: active users only
    const whereClause = userIds && Array.isArray(userIds) && userIds.length > 0
      ? { id: userIds, deletedAt: null }
      : { schoolId: req.user.schoolId, deletedAt: null };

    // Fetch users with enrollments
    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'ime', 'prezime', 'email'],
      include: [{
        model: sequelize.models.Enrollment,
        as: 'enrollments',
        attributes: ['agreementAccepted', 'active', 'schoolYear']
      }]
    });

    // Filter to those who have not accepted
    const targets = users.filter(u => {
      const hasEnrollments = Array.isArray(u.enrollments) && u.enrollments.length > 0;
      if (!hasEnrollments) return true;
      return u.enrollments.some(e => e.active && !e.agreementAccepted);
    });

    if (targets.length === 0) {
      return res.json({ success: true, message: 'Nema korisnika za podsjetiti.', successCount: 0, errorCount: 0, total: 0 });
    }

    // Prepare transporter (reuse same settings as sendPasswordEmail)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      secureOptions: 'TLSv1_2',
    });

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    // Compose email content (supports custom message)
    const composeHtml = (ime, prezime) => {
      const greeting = `Poštovani ${xss(ime || '')} ${xss(prezime || '')},`;
      let bodyHtml;
      if (customMessage && typeof customMessage === 'string') {
        // Sanitize and preserve newlines
        const safe = xss(customMessage).replace(/\n/g, '<br/>');
        bodyHtml = `<p>${safe}</p>`;
      } else {
        bodyHtml = `
          <p>Ukoliko i dalje želite nastaviti s vašim glazbenim obrazovanjem u školi , molimo vas da dovršite proces upisa na Cadenza platformi:</p>
          <ul>
            <li>Prijavite se na <a href="https://cadenza.com.hr/login">Cadenza</a></li>
            <li>Prihvatite uvjete upisa</li>
            <li>Odaberite program ako ga nemate dodijeljenog</li>
          </ul>
        `;
      }
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
          <div style="text-align: center;">
            <img src="https://cadenza.com.hr/logo512.png" alt="Cadenza Logo" style="max-width: 150px;" />
            <h1 style="color: rgb(252, 163, 17); font-size: 22px;">Podsjetnik: dovršite upis</h1>
          </div>
          <p>${greeting}</p>
          ${bodyHtml}
          <p>Za pomoć, javite se na <a href="mailto:app.info.cadenza@gmail.com">app.info.cadenza@gmail.com</a>.</p>
          <p>Hvala!<br/>Cadenza</p>
        </div>
      `;
    };

    for (const user of targets) {
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: 'Podsjetnik: dovršite upis u školsku godinu 2025/2026 - Cadenza',
          html: composeHtml(user.ime, user.prezime)
        };

        await transporter.sendMail(mailOptions);
        successCount += 1;
        results.push({ id: user.id, email: user.email, status: 'sent' });
      } catch (err) {
        errorCount += 1;
        results.push({ id: user.id, email: user.email, status: 'error', message: err.message });
      }
    }

    return res.json({ success: true, message: 'Podsjetnici poslani', successCount, errorCount, total: targets.length, results });
  } catch (error) {
    console.error('Error sending enrollment reminders:', error);
    return res.status(500).json({ success: false, message: 'Greška pri slanju podsjetnika', error: error.message });
  }
};
const updatePassword = asyncWrapper(async (req, res) => {
  const { userId, userType, email } = req.body;

  try {
    // Find user model based on userType
    const Model = userType === 'student' ? User : Mentor;

    // Find the user by primary key (ID)
    const user = await Model.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'Korisnik nije pronađen.' });
    }

    // Check cooldown (lastPasswordReset needs to be a column in the database)
    if (user.lastPasswordReset &&
        Date.now() - new Date(user.lastPasswordReset).getTime() < 24 * 60 * 60 * 1000) {
      return res.status(429).json({
        message: 'Molimo pričekajte 24 sata između resetiranja lozinke.'
      });
    }

    // Generate new password
    const passwordLength = 8;
    const korisnickoIme = user.korisnickoIme;
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const newPassword = Array.from(
      { length: passwordLength },
      () => characters.charAt(Math.floor(Math.random() * characters.length))
    ).join('');

    // Hash the new password
    const hashedPassword = bcrypt.hashSync(newPassword, 8);

    // Update user password and last password reset timestamp
    user.password = hashedPassword;
    user.lastPasswordReset = new Date();

    // Save the updated user
    await user.save();

    // Send email using existing Nodemailer configuration
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      secureOptions: 'TLSv1_2',
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Nova lozinka - Cadenza',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
        <!-- Header section with logo -->
        <div style="text-align: center;">
          <img src="https://cadenza.com.hr/logo512.png" alt="Cadenza Logo" style="max-width: 150px;" />
          <h1 style="color: rgb(252, 163, 17); font-size: 24px;">Nova lozinka za vaš račun</h1>
        </div>

        <!-- Email introduction -->
        <p>Poštovani,</p>
        <p>Vaša lozinka je resetirana. Ovdje su vaši novi podaci za prijavu:</p>

        <!-- Highlighted user details -->
        <div style="border: 1px solid #ddd; padding: 10px; background-color: #fff8e6; margin-bottom: 20px;">
          <p><strong>E-mail adresa:</strong> ${email}</p>
          <p><strong>Korisničko ime:</strong> ${korisnickoIme}</p>
          <p><strong>Nova lozinka:</strong> ${newPassword}</p>
        </div>

        <!-- Call to action button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://cadenza.com.hr/login" style="
            background-color: rgb(252, 163, 17);
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: bold;
            display: inline-block;
            transition: background-color 0.3s ease;
            ">Prijavite se</a>
        </div>

        <!-- Support and closing -->
        <p>Molimo vas da čuvate ove informacije i ne dijelite lozinku. Ako imate bilo kakvih pitanja ili nedoumica, slobodno se obratite na adresu za podršku: <a href="mailto:app.info.cadenza@gmail.com">app.info.cadenza@gmail.com</a>.</p>

        <p>S poštovanjem,<br />Cadenza</p>
      </div>

      <!-- Styling for hover effect -->
      <style>
        a:hover {
          background-color: rgba(252, 163, 17, 0.8);
        }
      </style>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: 'Nova lozinka je poslana na email.' });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ message: 'Greška pri resetiranju lozinke.' });
  }
});

// When fetching students or user with program
const getUserWithPrograms = async (req, res) => {
  try {
    // If no ID provided, use current user
    const userId = req.params.id || req.user.id;

    const user = await User.findOne({
      where: { id: userId },
      include: [{
        model: Program,
        as: 'programs',
        through: { attributes: [] }, // Skip junction table attributes
        attributes: ['id', 'naziv', 'tipovi', 'cijena'], // Add cijena to the attributes
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
};

const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const updateData = { fcmToken };
    const model = req.isMentor ? Mentor : User;

    await model.update(updateData, {
      where: { id: req.userId }
    });

    res.json({
      success: true,
      message: 'FCM token updated successfully'
    });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ message: 'Error updating FCM token' });
  }
};

const getOsnovniDetaljiSvihKorisnika = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        'id',
        'ime',
        'prezime',
        'isStudent',
        'schoolId',
        'email',
        'deletedAt'
      ]
    });

    // Format the response to include only necessary data
    const formattedUsers = users.map(user => ({
      id: user.id,
      ime: user.ime,
      prezime: user.prezime,
      isStudent: user.isStudent,
      email: user.email,
      schoolId: user.schoolId,
      isActive: !user.deletedAt
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      message: 'Error fetching users',
      error: error.message
    });
  }
};

const checkEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ where: { email } });
    res.json({ exists: !!user });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ message: 'Error checking email' });
  }
};

// Get user statistics for admin dashboard
const getUserStats = async (req, res) => {
  try {
    const { schoolId } = req.query;

    // Build where clause based on schoolId
    const whereClause = schoolId ? { schoolId, deletedAt: null } : { deletedAt: null };

    // Get total users count
    const totalUsers = await User.count({ where: whereClause });

    // Get students count
    const totalStudents = await User.count({
      where: {
        ...whereClause,
        isStudent: true
      }
    });

    // Get mentors count (from Mentor table)
    const totalMentors = await Mentor.count({
      where: schoolId ? { schoolId, deletedAt: null } : { deletedAt: null }
    });

    // Get admins count
    const totalAdmins = await User.count({
      where: {
        ...whereClause,
        isAdmin: true
      }
    });

    res.json({
      totalUsers,
      totalStudents,
      totalMentors,
      totalAdmins
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};

// Get other user accounts linked to the same email as the current user
const getLinkedAccounts = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.json({ accounts: [] });
    }

    const accounts = await User.findAll({
      where: { email, deletedAt: null },
      attributes: ['id', 'ime', 'prezime', 'korisnickoIme']
    });

    const formatted = accounts.map(acc => ({
      id: acc.id,
      ime: acc.ime,
      prezime: acc.prezime,
      korisnickoIme: acc.korisnickoIme,
      isCurrent: acc.id === req.user.id
    }));

    res.json({ accounts: formatted });
  } catch (error) {
    console.error('Error fetching linked accounts:', error);
    res.status(500).json({ message: 'Error fetching linked accounts' });
  }
};

module.exports = {
  signup,
  updatePassword,
  login,
  verifyToken,
  getUser,
  refreshToken,
  logout,
  getKorisnici,
  getDetaljiKorisnika,
  updateDetaljiKorisnika,
  getAllStudents,
  searchUsersAndMentors,
  getUserInvoices,
  deleteUser,
  getUserWithPrograms,
  updateFcmToken,
  getOsnovniDetaljiKorisnika,
  getOsnovniDetaljiSvihKorisnika,
  checkEmail,
  getUserStats
  ,
  getLinkedAccounts
};

// --- New: Two-step bulk upload (preview + commit) ---

// Extract plain string from ExcelJS cell value (handles hyperlinks, richText, formulas)
const extractCellText = (val) => {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    // Hyperlink object: { text, hyperlink }
    if (val.text) return String(val.text);
    // Rich text: { richText: [{ text } ...] }
    if (Array.isArray(val.richText)) {
      return val.richText.map(rt => rt.text || '').join('');
    }
    // Formula value
    if (val.result != null) return String(val.result);
  }
  try { return String(val); } catch (_) { return ''; }
};

// Build a normalized candidate object from worksheet row
const buildCandidateFromRow = (row, schoolId) => {
  const ime = extractCellText(row.getCell(1).value).trim();
  const prezime = extractCellText(row.getCell(2).value).trim();
  const email = extractCellText(row.getCell(3).value).trim();
  const oib = extractCellText(row.getCell(4).value).trim();
  const brojMobitela = extractCellText(row.getCell(5).value).trim() || null;

  const ulica = extractCellText(row.getCell(6).value).trim();
  const kucniBroj = extractCellText(row.getCell(7).value).trim();
  const mjesto = extractCellText(row.getCell(8).value).trim();
  const adresa = (ulica || kucniBroj || mjesto) ? {
    ulica: ulica || '',
    kucniBroj: kucniBroj || '',
    mjesto: mjesto || ''
  } : null;

  const r1Ime = extractCellText(row.getCell(9).value).trim();
  const r1Prezime = extractCellText(row.getCell(10).value).trim();
  const r1Mob = extractCellText(row.getCell(11).value).trim();
  const roditelj1 = (r1Ime || r1Prezime || r1Mob) ? {
    ime: r1Ime || '',
    prezime: r1Prezime || '',
    brojMobitela: r1Mob || ''
  } : null;

  const r2Ime = extractCellText(row.getCell(12).value).trim();
  const r2Prezime = extractCellText(row.getCell(13).value).trim();
  const r2Mob = extractCellText(row.getCell(14).value).trim();
  const roditelj2 = (r2Ime || r2Prezime || r2Mob) ? {
    ime: r2Ime || '',
    prezime: r2Prezime || '',
    brojMobitela: r2Mob || ''
  } : null;

  const programName = extractCellText(row.getCell(15).value).trim() || null;
  const mentorName = extractCellText(row.getCell(16).value).trim() || null;

  return {
    ime,
    prezime,
    email,
    oib,
    brojMobitela,
    adresa,
    roditelj1,
    roditelj2,
    programName,
    mentorName,
    isStudent: true,
    schoolId
  };
};

// Preview: parse XLSX, detect duplicates, return candidates to create
const previewBulkUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.getWorksheet(1);
    if (!sheet || !sheet.rowCount || sheet.rowCount < 2) {
      return res.status(400).json({ message: 'File is empty or missing data rows' });
    }

    const schoolId = req.user.schoolId;

    const candidates = [];
    const errors = [];

    // Start from row 2 (skip header) up to rowCount
    for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
      const row = sheet.getRow(rowIndex);
      if (!row || !row.hasValues) continue;
      const candidate = buildCandidateFromRow(row, schoolId);

      // Basic validation
      if (!candidate.ime || !candidate.prezime || !candidate.email || !candidate.oib) {
        errors.push({ row: rowIndex, status: 'error', message: 'Nedostaju obavezna polja (ime, prezime, email, OIB)' });
        continue;
      }
      // OIB format
      if (!/^\d{11}$/.test(String(candidate.oib))) {
        errors.push({ row: rowIndex, status: 'error', message: 'Neispravan format OIB-a (11 znamenki)' });
        continue;
      }
      candidates.push({ ...candidate, _row: rowIndex });
    }

    // Duplicate detection against DB by: OIB, email, or exact match of ime+prezime+email
    const emails = candidates.map(c => (typeof c.email === 'string' ? c.email.trim() : '')).filter(e => e);
    const oibs = candidates.map(c => (c.oib != null ? String(c.oib).trim() : '')).filter(o => o);

    const existing = await User.findAll({
      where: {
        [Op.or]: [
          { email: { [Op.in]: emails } },
          { oib: { [Op.in]: oibs } }
        ]
      },
      attributes: ['id', 'ime', 'prezime', 'email', 'oib']
    });

    const existingByEmail = new Map(existing.filter(u => u.email).map(u => [u.email, u]));
    const existingByOib = new Map(existing.filter(u => u.oib).map(u => [String(u.oib), u]));

    const duplicates = [];
    const toCreate = [];

    for (const c of candidates) {
      const matchByOib = existingByOib.get(String(c.oib));
      const matchByEmail = existingByEmail.get(c.email);
      const sameNameAndEmail = matchByEmail && matchByEmail.ime === c.ime && matchByEmail.prezime === c.prezime;

      if (matchByOib || sameNameAndEmail) {
        duplicates.push({
          row: c._row,
          reason: matchByOib ? 'OIB već postoji' : 'Isto ime/prezime i email postoje',
          existing: matchByOib || matchByEmail,
          candidate: c
        });
        continue;
      }
      toCreate.push(c);
    }

    return res.json({
      success: true,
      summary: {
        total: (errors.length + candidates.length),
        valid: toCreate.length,
        duplicates: duplicates.length,
        errors: errors.length
      },
      toCreate,
      duplicates,
      errors
    });
  } catch (error) {
    console.error('Error in previewBulkUsers:', error);
    return res.status(500).json({ message: 'Error processing preview', error: error.message });
  }
};

// Commit: create users from validated array (JSON body), skip server-side duplicates again
const commitBulkUsers = async (req, res) => {
  try {
    const { users } = req.body || {};
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'No users provided' });
    }

    const schoolId = req.user.schoolId;

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const u of users) {
      try {
        // Re-check duplicates by OIB or (ime+prezime+email)
        const byOib = u.oib ? await User.findOne({ where: { oib: String(u.oib) } }) : null;
        const byEmail = u.email ? await User.findAll({ where: { email: u.email } }) : [];
        const sameNameEmail = (byEmail || []).find(e => e.ime === u.ime && e.prezime === u.prezime);
        if (byOib || sameNameEmail) {
          errorCount++;
          results.push({ status: 'skipped', email: u.email, reason: byOib ? 'OIB već postoji' : 'Isto ime/prezime i email postoje' });
          continue;
        }

        const korisnickoIme = await generateUsername(u.ime, u.prezime);

        const passwordLength = 8;
        const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const randomPassword = Array.from({ length: passwordLength }, () =>
          characters.charAt(Math.floor(Math.random() * characters.length))
        ).join('');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const created = await sequelize.transaction(async (t) => {
          const newUser = await User.create({
            email: u.email,
            password: hashedPassword,
            ime: u.ime,
            prezime: u.prezime,
            isAdmin: false,
            isMentor: false,
            isStudent: true,
            korisnickoIme,
            brojMobitela: u.brojMobitela || null,
            oib: u.oib,
            adresa: u.adresa || null,
            roditelj1: u.roditelj1 || null,
            roditelj2: u.roditelj2 || null,
            pohadjaTeoriju: false,
            customAttributes: {},
            napomene: [],
            maloljetniClan: false,
            schoolId: u.schoolId || schoolId || 1,
            mentorId: [],
            racuni: [],
            programType: null
          }, { transaction: t });

          // Optionally map programName and mentorName if provided
          if (u.programName) {
            try {
              const program = await Program.findOne({
                where: {
                  naziv: { [Op.iLike]: String(u.programName).trim() },
                  schoolId: newUser.schoolId
                },
                transaction: t
              });
              if (program) {
                await newUser.addProgram(program, { transaction: t });
              }
            } catch (_) {}
          }

          // mentorName mapping can be added later if needed; keep minimal at commit

          return newUser;
        });

        await sendPasswordEmail(u.email, randomPassword, korisnickoIme);

        successCount++;
        results.push({ status: 'success', email: u.email, korisnickoIme, id: created.id });
      } catch (err) {
        errorCount++;
        results.push({ status: 'error', email: u.email, message: err.message });
      }
    }

    return res.json({
      message: `Processed ${users.length} users`,
      successCount,
      errorCount,
      results
    });
  } catch (error) {
    console.error('Error in commitBulkUsers:', error);
    return res.status(500).json({ message: 'Error committing users', error: error.message });
  }
};

module.exports.previewBulkUsers = previewBulkUsers;
module.exports.commitBulkUsers = commitBulkUsers;
