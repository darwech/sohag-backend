const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
        trim: true
    },
    university: {
        type: String,
        required: true,
        // 👇 تحديث قائمة الجامعات المسموحة
        enum: ['sohag'] 
    },
    college: {
        type: String,
        required: true
    },
    year: { 
        type: String,
        required: true,
        enum: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'P.G.']
    },
    uploaderName: { // حقل الرافع (كما اتفقنا عليه)
        type: String,
        required: false,
        default: 'مساهم مجهول'
    },
    fileName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Summary', summarySchema);