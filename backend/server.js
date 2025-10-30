const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
// const fs = require('fs'); // <-- مبقاش ليه لازمة
const mongoose = require('mongoose');

// (جديد) استدعاء مكتبات كلاوديناري
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// تصحيح مسار النموذج: يبحث عن الملف داخل مجلد models
const Summary = require(path.join(__dirname, 'models', 'Summary.js')); 

const app = express();
const PORT = process.env.PORT || 5000; // (تعديل مهم لـ Render)

// ===================================
// ** كود الاتصال بقاعدة البيانات (MongoDB) **
// ===================================
const DB_URI = 'mongodb+srv://mola5as_user:TKWr7t6SVgAzOqcy@cluster0.9rarkhk.mongodb.net/Mola5asDB?retryWrites=true&w=majority&appName=Cluster0'; 

mongoose.connect(DB_URI)
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات MongoDB بنجاح!'))
  .catch(err => console.log('🔴 فشل الاتصال بقاعدة البيانات:', err));
// ===================================


app.use(cors());

// ===================================
// ** (جديد) إعدادات Cloudinary **
// ===================================
// (حط بياناتك اللي نسختها من ملف النوت باد)
cloudinary.config({ 
    cloud_name: 'dbnk0fgkl', // <-- ده اسم الكلاود بتاعك
    api_key: '--- الـ API Key اللي نسخته ---', 
    api_secret: '--- الـ API Secret اللي نسخته ---'
});

// 3. اعمل "مخزن" Cloudinary (بدل 'uploads')
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'sohag_summaries', // اسم الفولدر اللي هتتخزن فيه الملفات
        allowed_formats: ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'zip'], // الامتدادات المسموحة
        // (إضافة مهمة) هنخلي اسم الملف هو اسم المادة والسنة عشان التنظيم
        public_id: (req, file) => {
             // بيولد اسم زي: "cs_Year_2_16788865...-original_name"
            const subject = req.body.subject || 'unknown_subject';
            const year = req.body.year || 'unknown_year';
            return `${subject.replace(/ /g, '_')}_${year}_${Date.now()}-${file.originalname}`;
        }
    }
});

// 4. عدّل الـ multer بتاعك (امسح الإعدادات القديمة)
const upload = multer({ storage: storage }); // السطر ده بيقول لـ multer ارفع على المخزن الجديد
// ===================================


// (ملحوظة) المسارات دي مبقاش ليها لازمة لأن الواجهة هتترفع على Netlify لوحدها
// app.use(express.static(frontendPath));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.get('/', (req, res) => {
//   res.sendFile(path.join(frontendPath, 'index.html'));
// });


// ===================================
// ** 1. (معدل) نقطة اتصال الرفع والحفظ في MongoDB **
// ===================================
app.post('/api/upload', upload.single('fileUpload'), async (req, res) => { 
    
    // استقبال جميع الحقول
    const { subject, college, university, year, uploaderName: rawUploaderName } = req.body; 
    const file = req.file;

    if (!file) {
        return res.status(400).send({ message: 'الرجاء اختيار ملف لرفعه.' });
    }
    
    // !!!!! --- أهم تغيير في الكود كله --- !!!!!
    // Cloudinary بيرجعلك رابط الملف كامل جاهز على النت
    const fileUrl = req.file.path; // <-- ده الرابط الآمن بتاع الملف (https://...)
    const originalName = req.file.originalname; // <-- اسم الملف الأصلي
    // ---------------------------------------------
    
    const finalUploaderName = (rawUploaderName && rawUploaderName.trim()) ? rawUploaderName.trim() : undefined;

    try {
        // إنشاء كائن جديد وحفظ بياناته في MongoDB
        const newSummary = new Summary({
            subject: subject,
            university: university,
            college: college,
            year: year,
            uploaderName: finalUploaderName,
            
            // (تعديل) هنخزن الاسم الأصلي ورابط كلاوديناري
            fileName: originalName,  // <-- الاسم الأصلي (مثال: "ملزمة 1.pdf")
            fileUrl: fileUrl         // <-- رابط الملف على النت (https://res.cloudinary.com/...)
            
            // (ملحوظة) لو الموديل بتاعك اسمه filePath امسح السطر اللي فوق واكتب ده:
            // filePath: fileUrl
        });
        
        await newSummary.save(); // حفظ البيانات

        console.log(`✅ تم حفظ ملخص جديد للمادة: ${subject} (${year}) بواسطة ${finalUploaderName || 'مجهول'}`);
        res.status(200).send({ message: 'تم رفع الملف وحفظ بياناته بنجاح!', fileUrl: fileUrl });

    } catch (error) {
        console.error('🔴 خطأ في حفظ الملخص:', error);
        res.status(500).send({ message: 'حدث خطأ في قاعدة البيانات.' });
    }
});


// ===================================
// ** 2. نقطة اتصال جلب الملخصات (للتصفية) **
// ===================================
app.get('/api/summaries/:collegeId/:yearId', async (req, res) => {
    const collegeId = req.params.collegeId;
    const yearId = req.params.yearId; 
    
    try {
        // البحث في قاعدة البيانات
        // (الكود ده سليم زي ما هو، لأنه بيرجع الأوبجكت كامل بالـ fileUrl الجديد)
        const summaries = await Summary.find({ college: collegeId, year: yearId }).sort({ uploadDate: -1 });
        
        res.status(200).json(summaries); 

    } catch (error) {
        console.error('🔴 خطأ في جلب الملخصات:', error);
        res.status(500).send({ message: 'حدث خطأ أثناء جلب البيانات.' });
    }
});


// تشغيل السيرفر
app.listen(PORT, () => {
    // (تعديل) السيرفر هيشتغل على الرابط اللي Render هيديهولك
    console.log(`الباك إند يعمل الآن على البورت: ${PORT}`);
});