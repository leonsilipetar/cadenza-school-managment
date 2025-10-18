const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollment-controller');
const { verifyToken } = require('../controllers/user-controller');
const { enrollmentLimiter, enrollmentStatusLimiter } = require('../middleware/rateLimiter');

// User: Get current enrollment status
router.get('/current', verifyToken, enrollmentStatusLimiter, enrollmentController.getCurrentEnrollment);

// User: Accept/confirm enrollment
router.post('/accept', verifyToken, enrollmentLimiter, enrollmentController.acceptEnrollment);

// Admin: List/filter enrollments
router.get('/list', verifyToken, enrollmentController.listEnrollments);

// Admin: Get enrollment statistics
router.get('/stats', verifyToken, enrollmentController.getEnrollmentStats);

// Student: Generate own enrollment confirmation PDF
router.get('/my/upis-pdf', verifyToken, enrollmentController.generateMyEnrollmentConfirmation);

// Admin: Generate enrollment confirmation PDF for a user
router.get('/confirmation/:userId/pdf', verifyToken, enrollmentController.generateEnrollmentConfirmation);

// Admin: Generate one multi-page PDF for multiple users
router.post('/confirmation/bulk/pdf', verifyToken, enrollmentController.generateEnrollmentConfirmationBulk);

// Get agreement text
router.get('/agreement', enrollmentController.getAgreementText);

module.exports = router; 