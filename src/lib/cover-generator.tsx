import { ImageResponse } from '@vercel/og';
import fs from 'fs';
import path from 'path';

export async function generateCover(data: {
  title_ar: string;
  title_en: string;
  subtitle_ar?: string;
  subtitle_en?: string;
}) {
  try {
    console.log("🎨 جاري رسم الغلاف...");
    
    // قراءة ملفات الخط الحقيقية (الأحجام الآن صحيحة: ~400 KB)
    const fontRegular = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'Tajawal-Regular.ttf'));
    const fontBold = fs.readFileSync(path.join(process.cwd(), 'public', 'fonts', 'Tajawal-Bold.ttf'));
    
    const logoPath = path.join(process.cwd(), 'public', 'logos', 'hr-icon.png');
    let logoBase64 = '';
    
    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch {
      console.warn("⚠️ لم يتم العثور على الشعار");
    }

    const response = new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 1600,
            background: 'linear-gradient(180deg, #000000 0%, #0A192F 100%)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            fontFamily: 'Tajawal',
            padding: '60px',
          }}
        >
          {/* الشعار في أعلى اليسار */}
          <div style={{ position: 'absolute', top: 40, left: 60, display: 'flex', alignItems: 'center', gap: 15 }}>
            {logoBase64 && (
              <img src={logoBase64} alt="Hidden Radiology" style={{ width: 80, height: 80 }} />
            )}
            {/* تم إضافة display: flex و flexDirection هنا لحل الخطأ */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700 }}>Hidden Radiology</div>
              <div style={{ color: '#00E5FF', fontSize: 14 }}>See Beyond The Image</div>
            </div>
          </div>

          {/* المحتوى الرئيسي */}
          <div style={{ marginTop: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ fontSize: 56, fontWeight: 700, color: '#00E5FF', textAlign: 'center', marginBottom: 20 }}>
              {data.title_en}
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, color: '#FFFFFF', textAlign: 'center', marginBottom: 40 }}>
              {data.title_ar}
            </div>
            <div style={{ width: 300, height: 3, background: '#00E5FF', marginBottom: 40 }} />
            
            {data.subtitle_en && (
              <div style={{ fontSize: 28, color: '#8892B0', textAlign: 'center', marginBottom: 10 }}>
                {data.subtitle_en}
              </div>
            )}
            {data.subtitle_ar && (
              <div style={{ fontSize: 28, color: '#8892B0', textAlign: 'center' }}>
                {data.subtitle_ar}
              </div>
            )}
          </div>

          {/* الأيقونات السفلية */}
          <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '2px solid #00E5FF', paddingTop: 30 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#00E5FF', fontSize: 18 }}>
              <span style={{ fontSize: 32, marginBottom: 8 }}>📖</span>
              <span>Study Guide</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#00E5FF', fontSize: 18 }}>
              <span style={{ fontSize: 32, marginBottom: 8 }}>🔬</span>
              <span>Diagnostics</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#00E5FF', fontSize: 18 }}>
              <span style={{ fontSize: 32, marginBottom: 8 }}>🎓</span>
              <span>Education</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#00E5FF', fontSize: 18 }}>
              <span style={{ fontSize: 32, marginBottom: 8 }}>✓</span>
              <span>Checklists</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 1600,
        fonts: [
          { name: 'Tajawal', data: fontRegular, weight: 400 },
          { name: 'Tajawal', data: fontBold, weight: 700 },
        ],
      }
    );

    console.log("✅ تم رسم الغلاف بنجاح");
    return await response.arrayBuffer();
  } catch (error: unknown) {
    console.error('❌ خطأ:', error);
    throw new Error('Failed to generate cover: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}
