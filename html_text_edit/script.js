const htmlCode = document.getElementById('html-code');
const previewDisplay = document.getElementById('preview-display');

// เริ่มต้นด้วยโค้ดตัวอย่าง
const initialCode = `<h1>สวัสดีชาวโลก</h1>
<p>ลองคลิกที่ข้อความนี้เพื่อ <b>แก้ไข</b> ดูสิ!</p>
<ul>
  <li>รายการที่ 1</li>
  <li>รายการที่ 2</li>
</ul>`;

htmlCode.value = initialCode;
previewDisplay.innerHTML = initialCode;

// 1. เมื่อพิมพ์ใน Editor -> อัปเดต Preview
htmlCode.addEventListener('input', () => {
    previewDisplay.innerHTML = htmlCode.value;
});

// 2. เมื่อแก้ไขใน Preview -> อัปเดต Editor
previewDisplay.addEventListener('input', () => {
    // ดึง HTML จากหน้า Preview กลับไปใส่ใน Textarea
    htmlCode.value = previewDisplay.innerHTML;
});

// ป้องกันการกด Enter แล้วโครงสร้างพัง (Optional)
// ปกติ browser จะใส่ <div> หรือ <br> เมื่อกด enter ใน contenteditable