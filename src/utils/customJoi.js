const { Joi } = require('celebrate');
const { ObjectId } = require('mongodb');

const email = () => Joi.string().lowercase().email({ minDomainSegments: 2 });
const basicPassword = () =>
  Joi.string()
    .min(8)
    .max(72)

const objectId = () =>
  Joi.string()
    .trim()
    .custom((value, helpers) => {
      if (ObjectId.isValid(value)) return value;
      return helpers.error('any.invalid');
    }, 'ObjectId validator');

const otp = () => Joi.string().trim().regex(/^([0-9]{4})$/);

module.exports = {
  email,
  basicPassword,
  objectId,
  otp,
};

