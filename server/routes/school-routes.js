const express = require('express');
const { verifyToken } = require('../controllers/user-controller');
const {
    getSchools,
    getSchoolById,
    createSchool,
    updateSchool,
    deleteSchool,
    getSchoolStats,
    registerSchool
} = require('../controllers/school-controller');

const router = express.Router();

// PUBLIC ROUTE - School self-registration
router.post('/schools/register', registerSchool); // NO verifyToken - public access

// Protected school routes (require authentication)
router.get('/schools', verifyToken, getSchools);
router.get('/schools/:id', verifyToken, getSchoolById);
router.post('/schools', verifyToken, createSchool);
router.put('/schools/:id', verifyToken, updateSchool);
router.delete('/schools/:id', verifyToken, deleteSchool);
router.get('/schools/:id/stats', verifyToken, getSchoolStats);

module.exports = router; 