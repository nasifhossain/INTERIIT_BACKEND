const bcrypt = require('bcrypt');
const AppError = require('./appError');

// Default salt rounds
const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param {String} password - Plain text password to hash
 * @param {Number} saltRounds - Number of salt rounds (default: 12)
 * @returns {String} Hashed password
 */
const hashPassword = async (password, saltRounds = SALT_ROUNDS) => {
    try {
        if (!password) {
            throw new AppError('Password is required for hashing', 400);
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError('Error hashing password', 500);
    }
};

/**
 * Compare a plain text password with a hashed password
 * @param {String} password - Plain text password
 * @param {String} hashedPassword - Hashed password to compare against
 * @returns {Boolean} True if passwords match, false otherwise
 */
const comparePassword = async (password, hashedPassword) => {
    try {
        if (!password || !hashedPassword) {
            throw new AppError('Password and hashed password are required for comparison', 400);
        }

        const isMatch = await bcrypt.compare(password, hashedPassword);
        return isMatch;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError('Error comparing passwords', 500);
    }
};

/**
 * Validate password strength
 * @param {String} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
const validatePassword = (password) => {
    const errors = [];
    
    if (!password) {
        errors.push('Password is required');
        return { isValid: false, errors };
    }

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/(?=.*[@$!%*?&])/.test(password)) {
        errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Generate a secure random password
 * @param {Number} length - Length of the password (default: 12)
 * @returns {String} Generated password
 */
const generateRandomPassword = (length = 12) => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '@$!%*?&';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
};

module.exports = {
    hashPassword,
    comparePassword,
    validatePassword,
    generateRandomPassword,
    SALT_ROUNDS
};