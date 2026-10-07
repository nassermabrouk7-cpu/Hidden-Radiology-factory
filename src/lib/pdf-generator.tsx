import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// 1. تسجيل خط Tajawal المضمون 100% من GitHub (يتجنب خطأ 404 نهائياً)
Font.register({
  family: 'Tajawal',
  fonts: [
    {
      src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Bold.ttf',
      fontWeight: 700,
    },
  ],
});

// 2. تنسيقات الصفحة
const styles = StyleSheet.create({
  page: { 
    padding: 40, 
    fontFamily: 'Tajawal', 
    direction: 'rtl',
    backgroundColor: '#FFFFFF'
  },
  header: { 
    fontSize: 12, 
    color: '#00E5FF', 
    marginBottom: 40, 
    textAlign: 'center', 
    fontWeight: 700 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 700, 
    marginBottom: 15, 
    textAlign: 'center', 
    color: '#0A192F' 
  },
  subtitle: { 
    fontSize: 18, 
    marginBottom: 40, 
    textAlign: 'center', 
    color: '#8892B0',
    fontWeight: 400
  },
  contentBox: {
    marginTop: 40,
    borderTop: '2px solid #00E5FF',
    paddingTop: 30,
  },
  text: { 
    fontSize: 14, 
    lineHeight: 1.8, 
    marginBottom: 15, 
    color: '#333333',
    textAlign: 'justify'
  },
  footer: { 
    position: 'absolute', 
    bottom: 30, 
    left: 0, 
    right: 0, 
    textAlign: 'center',
    fontSize: 10, 
    color: '#8892B0' 
  }
});

// 3. مكون المستند
type PDFData = {
  title_ar: string;
  title_en: string;
  subtitle_ar?: string;
  subtitle_en?: string;
};

export const PDFDocument = ({ data }: { data: PDFData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text>Hidden Radiology - جودة وتميز في الأشعة</Text>
      </View>
      
      <Text style={styles.title}>{data.title_ar || data.title_en}</Text>
      <Text style={styles.subtitle}>{data.subtitle_ar || data.subtitle_en}</Text>
      
      <View style={styles.contentBox}>
        <Text style={styles.text}>
          مرحباً بك في هذا الدليل الشامل. تم إعداد هذا المحتوى بعناية فائقة لينقل لك أكثر من 30 عاماً من الخبرة العملية في مجال الأشعة، البروتوكولات الذهبية، وقوائم التدقيق لضمان الجودة.
        </Text>
        <Text style={styles.text}>
          نتمنى أن يكون هذا المرجع إضافة قيمة لمسيرتك المهنية، ومصدراً موثوقاً للمعلومات الدقيقة والمحدثة.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text>HiddenRadiology.com © 2024 | جميع الحقوق محفوظة</Text>
      </View>
    </Page>
  </Document>
);
