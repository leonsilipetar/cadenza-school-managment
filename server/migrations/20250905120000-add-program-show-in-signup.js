'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Program', 'showInSignup', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Controls if program is listed during signup (default visible)'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Program', 'showInSignup');
  }
};


