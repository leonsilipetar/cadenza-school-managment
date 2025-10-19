"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check and add showInSignup to Program table if it doesn't exist
    const programTable = await queryInterface.describeTable('Program');
    if (!programTable.showInSignup) {
      await queryInterface.addColumn('Program', 'showInSignup', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Controls if program is listed during signup (default visible)'
      });
      console.log('✅ Added showInSignup column to Program');
    } else {
      console.log('✓ showInSignup already exists');
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Program', 'showInSignup');
  },
};

