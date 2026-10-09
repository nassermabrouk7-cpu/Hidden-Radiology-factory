import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import path from 'node:path';

// Use fonts shipped with the app so production does not depend on GitHub/network access.
const fontDirectory = path.join(process.cwd(), 'public', 'fonts');
Font.register({
  family: 'Tajawal',
  fonts: [
    { src: path.join(fontDirectory, 'Tajawal-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontDirectory, 'Tajawal-Bold.ttf'), fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingHorizontal: 48, paddingBottom: 58, fontFamily: 'Tajawal', backgroundColor: '#FFFFFF' },
  header: { fontSize: 10, color: '#00AFC5', marginBottom: 32, textAlign: 'center', fontWeight: 700 },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 12, textAlign: 'center', color: '#0A192F' },
  subtitle: { fontSize: 16, marginBottom: 30, textAlign: 'center', color: '#68738A' },
  contentBox: { marginTop: 12, borderTop: '2px solid #00E5FF', paddingTop: 24 },
  text: { fontSize: 12, lineHeight: 1.8, marginBottom: 13, color: '#333333', textAlign: 'justify' },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, textAlign: 'center', fontSize: 9, color: '#8892B0' },
});

export type PDFData = {
  title_ar: string;
  title_en: string;
  subtitle_ar?: string;
  subtitle_en?: string;
  language: 'ar' | 'en';
  manuscript: string;
};

export const PDFDocument = ({ data }: { data: PDFData }) => {
  const isArabic = data.language === 'ar';
  const paragraphs = data.manuscript.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const title = isArabic ? data.title_ar : data.title_en;
  const subtitle = isArabic ? data.subtitle_ar : data.subtitle_en;

  return (
    <Document title={title} author="Hidden Radiology">
      <Page size="A4" style={[styles.page, { direction: isArabic ? 'rtl' : 'ltr' }]} wrap>
        <Text style={styles.header} fixed>{isArabic ? 'Hidden Radiology | دليل مهني' : 'Hidden Radiology | Professional Guide'}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.contentBox}>
          {paragraphs.map((paragraph, index) => <Text key={index} style={styles.text} orphans={2} widows={2}>{paragraph}</Text>)}
        </View>
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) =>
          `${isArabic ? 'HiddenRadiology.com | جميع الحقوق محفوظة' : 'HiddenRadiology.com | All rights reserved'}  •  ${pageNumber} / ${totalPages}`
        } />
      </Page>
    </Document>
  );
};
