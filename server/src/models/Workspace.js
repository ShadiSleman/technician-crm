const mongoose = require('mongoose')

const workspaceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HvacUser',
      required: true,
      unique: true,
    },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
)

module.exports = mongoose.model('HvacWorkspace', workspaceSchema)
