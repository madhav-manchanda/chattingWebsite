const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const CustomSticker = sequelize.define('CustomSticker', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

module.exports = CustomSticker;
