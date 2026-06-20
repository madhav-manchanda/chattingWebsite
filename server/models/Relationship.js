const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Relationship = sequelize.define('Relationship', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'pending',
    allowNull: false
  }
});

module.exports = Relationship;
