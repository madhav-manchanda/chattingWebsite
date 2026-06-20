const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Block = sequelize.define('Block', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  }
});

module.exports = Block;
