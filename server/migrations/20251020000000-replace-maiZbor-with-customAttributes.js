"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove maiZbor from User table if it exists
    const userTable = await queryInterface.describeTable('User');
    if (userTable.maiZbor) {
      await queryInterface.removeColumn("User", "maiZbor");
    }

    // Add customAttributes to User table
    await queryInterface.addColumn("User", "customAttributes", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Flexible JSON field for school-specific custom attributes (e.g., choir membership, ensembles, special programs)'
    });

    // Remove maiZbor from PendingUsers table if it exists
    const pendingUsersTable = await queryInterface.describeTable('PendingUsers');
    if (pendingUsersTable.maiZbor) {
      await queryInterface.removeColumn("PendingUsers", "maiZbor");
    }

    // Add customAttributes to PendingUsers table
    await queryInterface.addColumn("PendingUsers", "customAttributes", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Flexible JSON field for school-specific custom attributes'
    });
  },

  async down(queryInterface, Sequelize) {
    // Restore maiZbor to User table
    await queryInterface.addColumn("User", "maiZbor", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    // Remove customAttributes from User table
    await queryInterface.removeColumn("User", "customAttributes");

    // Restore maiZbor to PendingUsers table
    await queryInterface.addColumn("PendingUsers", "maiZbor", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    // Remove customAttributes from PendingUsers table
    await queryInterface.removeColumn("PendingUsers", "customAttributes");
  },
};

