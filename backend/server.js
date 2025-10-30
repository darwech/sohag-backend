const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// (جديد) لاستدعاء الأسرار من ملف .env
require('dotenv').config(); 

const Summary = require(path.join(__dirname, 'models', 'Summary.js')); 
const app = express();
const PORT = process.env.PORT || 3000; // Glitch بيفضل بورت 3000

// ===================================
// ** (معدل) الاتصال بقاعدة البيانات **
// (هيقرأ الرابط من ملف .env الآمن)
// ===================================
// (متخافش لو الرابط فاضي، هنملاه في Glitch)
const DB_URI = process.env.DB_URI; 

mongoose.connect(DB_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات MongoDB بنجاح!'))
  .catch(err => console.log('🔴 فشل الاتصال بقاعدة البيانات:', err));
// ===================================

app.use(cors());

// ===================================
// ** (معدل) إعدادات Cloudinary **
// (هيقرأ الأسرار من ملف .env الآمن)
// ===================================
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'sohag_summaries', 
        allowed_formats: ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'zip'],
        public_id: (req, file) => {
            const subject = req.body.subject || 'unknown_subject';
            const year = req.body.year || 'unknown_year';
            return `${subject.replace(/ /g, '_')}_${year}_${Date.now()}-${file.originalname}`;
        }
    }
});

const upload = multer({ storage: storage });
// ===================================


// ===================================
// ** 1. نقطة اتصال الرفع (Upload) **
// ===================================
app.post('/api/upload', upload.single('fileUpload'), async (req, res) => { 
    const { subject, college, university, year, uploaderName: rawUploaderName } = req.body; 
    const file = req.file;

    if (!file) {
        return res.status(400).send({ message: 'الرجاء اختيار ملف لرفعه.' });
    }
    
    const fileUrl = req.file.path;
    const originalName = req.file.originalname;
    const finalUploaderName = (rawUploaderName && rawUploaderName.trim()) ? rawUploaderName.trim() : undefined;

    try {
        const newSummary = new Summary({
            subject: subject,
            university: university,
            college: college,
            year: year,
            uploaderName: finalUploaderName,
            fileName: originalName,
            fileUrl: fileUrl 
        });
        
        await newSummary.save(); 
        console.log(`✅ تم حفظ ملخص جديد للمادة: ${subject} (${year})`);
        res.status(200).send({ message: 'تم رفع الملف وحفظ بياناته بنجاح!', fileUrl: fileUrl });

    } catch (error) {
        console.error('🔴 خطأ في حفظ الملخص:', error);
        res.status(500).send({ message: 'حدث خطأ في قاعدة البيانات.' });
    }
});


// ===================================
// ** 2. نقطة اتصال جلب الملخصات (Get) **
// ===================================
app.get('/api/summaries/:collegeId/:yearId', async (req, res) => {
    const collegeId = req.params.collegeId;
    const yearId = req.params.yearId; 
    
    try {
        const summaries = await Summary.find({ college: collegeId, year: yearId }).sort({ uploadDate: -1 });
        res.status(200).json(summaries); 

    } catch (error) {
        console.error('🔴 خطأ في جلب الملخصات:', error);
        res.status(500).send({ message: 'حدث خطأ أثناء جلب البيانات.' });
    }
});

// (جديد) مسار افتراضي عشان نتأكد إن السيرفر شغال
app.get("/", (req, res) => {
  res.send("أهلاً بك في الباك إند لموقع ملخصات سوهاج - السيرفر يعمل!");
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`الباك إند يعمل الآن على البورت: ${PORT}`);
});