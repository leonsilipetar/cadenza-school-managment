const PDFDocument = require('pdfkit');
const fs = require('fs');
const QRCode = require('qrcode');
const PDF417 = require('pdf417-generator');
const { createCanvas } = require('canvas');
const path = require('path');

const generateInvoicePDF = async (invoice, invoiceSettings, student, program) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a new PDF document with UTF-8 encoding and embedded fonts
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        lang: 'hr-HR',
        autoFirstPage: true,
        info: {
          Title: `${invoice.type === 'članarina' ? 'Članarina' : 'Račun'}-${invoice.invoiceNumber}`,
          Author: invoiceSettings.nazivObrta,
          Subject: invoice.type === 'članarina' ? 'Članarina' : 'Račun',
          Producer: 'MAI System'
        },
        pdfVersion: '1.7',
        tagged: true,
        displayTitle: true,
        bufferPages: true
      });

      // Set UTF-8 encoding
      doc.info.Producer = 'MAI System (UTF-8)';
      doc.info.Encoding = 'UTF-8';

      // Register the new font
      doc.registerFont('Croatian', path.join(__dirname, 'fonts', 'HedvigLettersSans-Regular.ttf'));
      doc.font('Croatian');

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Format addresses
      const fullAddress = `${invoiceSettings.address}, ${invoiceSettings.postalCode} ${invoiceSettings.city}`;
      const studentAddress = student?.adresa ?
        `${student.adresa.ulica} ${student.adresa.kucniBroj}, ${student.adresa.mjesto}` :
        '';

      // QR Code Generation
      const qrData = [
        'www.e-URA.hr',
        '01',
        invoiceSettings.nazivObrta,
        invoiceSettings.oib,
        invoiceSettings.iban.replace(/\s/g, ''),
        `91-${invoice.invoiceNumber}`,
        '3',
        `${student?.ime || ''} ${student?.prezime || ''}`.trim(),
        student?.oib || '',
        new Date().toLocaleDateString('hr-HR').replace(/\./g, ''),
        `${invoice.invoiceNumber}/1/1`,
        new Date(invoice?.dueDate).toLocaleDateString('hr-HR').replace(/\./g, ''),
        (Number(invoice.amount) || 0).toFixed(2),
        '0.00',
        '0.00',
        '0.00',
        '0.00',
        '0.00',
        '0.00',
        '0.00',
        (Number(invoice.amount) || 0).toFixed(2),
        '0.00'
      ].join('\n');

      // Generate PDF417 barcode
      const pdf417Data = `HRVHUB30
EUR
${(Number(invoice.amount) || 0).toFixed(2)}
${(student?.ime || '').trim()} ${(student?.prezime || '').trim()}
${invoiceSettings.nazivObrta.trim()}
${invoiceSettings.address.trim()}
${invoiceSettings.postalCode.trim()} ${invoiceSettings.city.trim()}
${invoiceSettings.iban.replace(/\s/g, '')}
HR99
${invoice.invoiceNumber}
COST
${invoice.type === 'članarina' ? 'Članarina' : 'Račun'} za ${invoice.month}/${invoice.year}`;

      // Create canvas for PDF417 barcode
      const canvas = new createCanvas();
      PDF417.draw(pdf417Data, canvas);
      const pdf417Url = canvas.toDataURL();

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        margin: 4,
        width: 200,
        scale: 8
      });

      // Calculate due date (15 days from issue date)
      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 15);

      // Add content to PDF with absolute positioning
      const margin = 50;
      const pageWidth = 595.28; // A4 width in points
      const pageHeight = 841.89; // A4 height in points

      // Title
      doc.fontSize(20)
         .text(`${invoice.type === 'članarina' ? 'ČLANARINA' : 'RAČUN'}`, margin, 50, { align: 'center', width: pageWidth - 2 * margin });

      // Invoice number and dates
      doc.fontSize(12)
         .text(`${invoice.type === 'članarina' ? 'ČLANARINA' : 'RAČUN'} br. ${invoice.invoiceNumber}`, pageWidth - margin - 200, 100, { width: 200, align: 'right' });
      doc.text(`Datum izdavanja: ${issueDate.toLocaleDateString('hr-HR')}`, pageWidth - margin - 200, 115, { width: 200, align: 'right' });
      doc.text(`Dospijeće: ${dueDate.toLocaleDateString('hr-HR')}`, pageWidth - margin - 200, 130, { width: 200, align: 'right' });

      // Company info
      doc.text(invoiceSettings.nazivObrta, margin, 100);
      doc.text(fullAddress, margin, 115);
      doc.text(`OIB: ${invoiceSettings.oib}`, margin, 130);
      doc.text(`IBAN: ${invoiceSettings.iban}`, margin, 145);

      // QR code
      doc.text(`QR kod za plaćanje`, margin, 180);
      doc.image(qrCodeUrl, margin, 200, { fit: [120, 120] });

      // Student info
      doc.text(`PRIMATELJ:`, margin, 330);
      doc.text(`${student?.ime || ''} ${student?.prezime || ''}`, margin, 345);
      if (studentAddress) {
        doc.text(studentAddress, margin, 360);
      }
      doc.text(`OIB: ${student?.oib || ''}`, margin, 375);

      // Table section
      doc.text(`STAVKE ${invoice.type === 'članarina' ? 'ČLANARINE' : 'RAČUNA'}`, margin, 410, { underline: true });
      doc.rect(margin, 430, pageWidth - 2 * margin, 25).fill('#f0f0f0').stroke();
      doc.fillColor('black');
      doc.text(`Naziv usluge`, margin + 10, 436);
      doc.text('J.mj.', margin + 300, 436);
      doc.text('Cijena', margin + 400, 436);

      // Table content - handle multiple programs
      let yPosition = 455;
      let totalAmount = 0;

      // Check if program is an array
      const programs = Array.isArray(program) ? program : [program];

      programs.forEach((prog, index) => {
        const programDesc = `${prog?.naziv || ''} ${prog.tip !== 'none' ? `(${prog.tip})` : ''}`;
        doc.rect(margin, yPosition, pageWidth - 2 * margin, 25).stroke();
        doc.text(programDesc, margin + 10, yPosition + 6);
        doc.text(`KOM`, margin + 300, yPosition + 6);
        doc.text(`${(Number(prog.cijena) || 0).toFixed(2)} EUR`, margin + 400, yPosition + 6);

        totalAmount += Number(prog.cijena) || 0;
        yPosition += 25;
      });

      // Total section - moved down to account for multiple programs
      doc.rect(pageWidth - margin - 200, yPosition + 10, 200, 25).stroke();
      doc.text(`Ukupno za platiti:`, pageWidth - margin - 190, yPosition + 16);
      doc.text(`${totalAmount.toFixed(2)} EUR`, pageWidth - margin - 80, yPosition + 16);

      // Payment details - adjusted positions based on table height
      doc.text(`Način plaćanja`, margin, yPosition + 50, { underline: true });
      doc.text(`Transakcijski račun`, margin, yPosition + 65);
      doc.text(`IBAN: ${invoiceSettings.iban}`, margin, yPosition + 80);
      doc.text(`Model i poziv na broj: ${invoice.invoiceNumber}`, margin, yPosition + 95);
      doc.text(`Svrha: ${invoice.type === 'članarina' ? 'Članarina' : 'Račun'} za ${getMonthName(invoice.month)} ${invoice.year}`, margin, yPosition + 110);

      // PDF417 barcode - adjusted position
      doc.text('2D barkod za plaćanje', margin, yPosition + 140);
      doc.image(pdf417Url, margin, yPosition + 155, { fit: [250, 80] });

      // Footer - adjusted position
      doc.fontSize(8)
         .text(`${invoice.type === 'članarina' ? 'Članarina' : 'Račun'} je ${invoice.type === 'članarina' ? 'izdana' : 'izdan'} elektronički i pravovaljan${invoice.type === 'članarina' ? 'a' : ''} je bez žiga i potpisa.`,
               margin, pageHeight - 70, { align: 'center', width: pageWidth - 2 * margin });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

// Helper function to get month name in Croatian
function getMonthName(monthNumber) {
  const months = [
    'siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj',
    'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'
  ];
  return months[monthNumber - 1];
}

const generateEnrollmentConfirmationPDF = async (user, invoiceSettings, enrollment) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        lang: 'hr-HR',
        info: {
          Title: `Potvrda o upisu - ${user.ime || ''} ${user.prezime || ''}`.trim(),
          Author: 'MAI System',
          Subject: 'Potvrda o upisu',
          Producer: 'MAI System'
        }
      });

      // Fonts: prefer Montserrat (Body) and Merriweather (Display), fallback to existing
      const tryRegister = (name, candidates) => {
        for (const file of candidates) {
          const abs = path.join(__dirname, 'fonts', file);
          try {
            if (fs.existsSync(abs)) {
              doc.registerFont(name, abs);
              return true;
            }
          } catch (_) {}
        }
        return false;
      };

      const bodyOk = tryRegister('Body', ['Montserrat-Regular.ttf', 'Montserrat.ttf', 'HedvigLettersSans-Regular.ttf']);
      const displayOk = tryRegister('Display', ['Merriweather-Regular.ttf', 'Merriweather.ttf', 'HeptaSlab-VariableFont_wght.ttf']);
      const displayBoldOk = tryRegister('DisplayBold', ['Merriweather-Bold.ttf', 'Merriweather-Black.ttf', 'HeptaSlab-VariableFont_wght.ttf']);

      if (!bodyOk) {
        // Ensure Body exists
        doc.registerFont('Body', path.join(__dirname, 'fonts', 'HedvigLettersSans-Regular.ttf'));
      }
      if (!displayOk) {
        doc.registerFont('Display', path.join(__dirname, 'fonts', 'HeptaSlab-VariableFont_wght.ttf'));
      }
      if (!displayBoldOk) {
        doc.registerFont('DisplayBold', path.join(__dirname, 'fonts', 'HeptaSlab-VariableFont_wght.ttf'));
      }

      doc.font('Body');

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const margin = 50;
      const pageWidth = 595.28;
      const pageHeight = doc.page?.height || 841.89;

      // Decorative border
      doc.save();
      doc.lineWidth(1).strokeColor('#dcdcdc');
      doc.rect(margin - 12, margin - 12, pageWidth - (margin - 12) * 2, pageHeight - (margin - 12) * 2).stroke();
      doc.restore();

      // Header with logo on the right
      const logoPath = path.join(__dirname, '../public/logo512.png');
      let logoX = pageWidth - margin - 100;
      try {
        doc.image(logoPath, logoX, 50, { fit: [100, 100] });
      } catch (_) {}
      // Title will be placed below header, centered

      // Unique confirmation number based on enrollment acceptance time: YYYYMMDDHHmmss-userId[-enrollmentId]
      const now = new Date();
      const acceptedAt = enrollment?.agreementAcceptedAt ? new Date(enrollment.agreementAcceptedAt) : null;
      const ts = acceptedAt || now;
      const dateStr = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
      const baseConf = `${dateStr}-${String(user.id || 0)}`;
      const confNum = enrollment?.id ? `${baseConf}-${String(enrollment.id)}` : baseConf;

      // School info from invoice settings (preferred) on the left header
      const s = invoiceSettings || {};
      const schoolTitle = s.nazivObrta || user.school?.name || 'Cadenza';
      const addrLine = s.address || '';
      const cityLine = [s.postalCode, s.city].filter(Boolean).join(' ');
      const oibLine = s.oib ? `OIB: ${s.oib}` : '';
      const noteLine = s.dodatneInformacije || '';

      const detailsWidth = 340;
      const detailsX = margin;
      const detailsY = 50;
      doc.font('Display').fontSize(12).fillColor('#000').text(`${schoolTitle}`, detailsX, detailsY, { width: detailsWidth, align: 'left' });
      doc.font('Body').fontSize(11).fillColor('#000');
      if (addrLine) doc.text(addrLine, detailsX, doc.y, { width: detailsWidth });
      if (cityLine) doc.text(cityLine, detailsX, doc.y, { width: detailsWidth });
      if (oibLine) doc.text(oibLine, detailsX, doc.y, { width: detailsWidth });
      if (noteLine) doc.text(`${noteLine}`, detailsX, doc.y, { width: detailsWidth });
      doc.fillColor('#000');
doc.moveTo(margin, 260).lineTo(pageWidth - margin, 260).strokeColor('#e0e0e0').stroke();
      // Title centered below header (moved down)
      doc.font('DisplayBold').fontSize(22).text('POTVRDA O UPISU', margin, 230, { width: pageWidth - margin * 2, align: 'center' });


      // Student info as a formal single sentence
      const adresa = user?.adresa ? `${user.adresa.ulica || ''} ${user.adresa.kucniBroj || ''}, ${user.adresa.mjesto || ''}`.trim() : '';
      const programs = Array.isArray(user.programs) ? user.programs : [];
      const programList = programs.length > 0 ? programs.map(p => p.naziv).join(', ') : 'Nije dodijeljeno';
      const fullName = [user.ime, user.prezime].filter(Boolean).join(' ');
      const oibPart = user.oib ? `, OIB ${user.oib}` : '';
      const addressPart = adresa ? `, ${adresa}` : '';
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const schoolYear = month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
      // Render sentence with required phrasing
      const ySentence = 280;
      const y1 = month >= 9 ? year : year - 1;
      const y2 = month >= 9 ? year + 1 : year;
      const schoolYearFormatted = `${y1}./${y2}.`;
      doc.font('Display').fontSize(12).fillColor('#000').text('Ovim se potvrđuje da je ', margin, ySentence, { width: pageWidth - margin * 2, continued: true });
      doc.font('Body').fillColor('#333').text(fullName, { continued: true });
      if (user.oib) {
        doc.font('Display').fillColor('#000').text(' (OIB: ', { continued: true });
        doc.font('Body').fillColor('#333').text(String(user.oib), { continued: true });
        doc.font('Display').fillColor('#000').text(')', { continued: true });
      }
      if (adresa) {
        doc.font('Display').fillColor('#000').text(', s prebivalištem na adresi ', { continued: true });
        doc.font('Body').fillColor('#333').text(adresa, { continued: true });
      }
      doc.font('Display').fillColor('#000').text(', upisan u program ', { continued: true });
      doc.font('Body').fillColor('#333').text(programList, { continued: true });
      doc.font('Display').fillColor('#000').text(' za školsku godinu ', { continued: true });
      doc.font('Body').fillColor('#333').text(schoolYearFormatted);


      doc.moveDown(4);
      const sigWidth = 240;
      const sigX = pageWidth - margin - sigWidth;
      const sigY = doc.y + 50;
      doc.text('_______________________________', sigX, sigY, { width: sigWidth, align: 'center' });
      doc.font('Body').fontSize(10).fillColor('#666').text('Ravnatelj / odgovorna osoba', sigX, sigY + 15, { width: sigWidth, align: 'center' });

      // Footer: show enrollment date and issue date just above the divider
      const datumUpisa = acceptedAt ? acceptedAt.toLocaleDateString('hr-HR') : '-';
      const datumIzdavanja = now.toLocaleDateString('hr-HR');
      doc.font('Body').fontSize(11).fillColor('#000')
        .text(`Datum upisa: ${datumUpisa}`, margin, pageHeight - margin - 60, { align: 'left' })
        .text(`Datum izdavanja potvrde: ${datumIzdavanja}`, margin, pageHeight - margin - 45, { align: 'left' });

      // Footer anchored at bottom with divider above
      doc.moveTo(margin, pageHeight - margin - 28).lineTo(pageWidth - margin, pageHeight - margin - 28).strokeColor('#e0e0e0').stroke();
      // Confirmation number right-aligned above divider
      doc.font('Body').fontSize(10).fillColor('#333').text(`Potvrda br. ${confNum}`, margin, pageHeight - margin - 45, { align: 'right', width: pageWidth - margin * 2 });
      doc.fontSize(9).fillColor('#666').text('Potvrda je generirana elektroničkim putem.', margin, pageHeight - margin - 20, { align: 'center', width: pageWidth - margin * 2 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateInvoicePDF,
  generateEnrollmentConfirmationPDF
};

// Generate a single PDF containing multiple enrollment confirmations (one per page)
module.exports.generateEnrollmentConfirmationPDFMulti = async (entries) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, lang: 'hr-HR' });

      // Fonts setup (reuse Montserrat/Merriweather fallbacks)
      const tryRegister = (name, candidates) => {
        for (const file of candidates) {
          const abs = path.join(__dirname, 'fonts', file);
          try { if (fs.existsSync(abs)) { doc.registerFont(name, abs); return true; } } catch (_) {}
        }
        return false;
      };
      const bodyOk = tryRegister('Body', ['Montserrat-Regular.ttf', 'Montserrat.ttf', 'HedvigLettersSans-Regular.ttf']);
      const displayOk = tryRegister('Display', ['Merriweather-Regular.ttf', 'Merriweather.ttf', 'HeptaSlab-VariableFont_wght.ttf']);
      const displayBoldOk = tryRegister('DisplayBold', ['Merriweather-Bold.ttf', 'Merriweather-Black.ttf', 'HeptaSlab-VariableFont_wght.ttf']);
      if (!bodyOk) doc.registerFont('Body', path.join(__dirname, 'fonts', 'HedvigLettersSans-Regular.ttf'));
      if (!displayOk) doc.registerFont('Display', path.join(__dirname, 'fonts', 'HeptaSlab-VariableFont_wght.ttf'));
      if (!displayBoldOk) doc.registerFont('DisplayBold', path.join(__dirname, 'fonts', 'HeptaSlab-VariableFont_wght.ttf'));

      doc.font('Body');

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const margin = 50;
      const pageWidth = 595.28;

      const renderOne = (user, invoiceSettings, enrollment, isFirst) => {
        if (!isFirst) doc.addPage();
        const pageHeight = doc.page?.height || 841.89;

        // Border
        doc.save();
        doc.lineWidth(1).strokeColor('#dcdcdc');
        doc.rect(margin - 12, margin - 12, pageWidth - (margin - 12) * 2, pageHeight - (margin - 12) * 2).stroke();
        doc.restore();

        // Logo right
        const logoPath = path.join(__dirname, '../public/MAI Logo.png');
        const logoWidth = 100;
        const logoX = pageWidth - margin - logoWidth;
        try { doc.image(logoPath, logoX, 50, { fit: [logoWidth, 100] }); } catch (_) {}

        // School details left header
        const s = invoiceSettings || {};
        const schoolTitle = s.nazivObrta || user.school?.name || 'Cadenza';
        const addrLine = s.address || '';
        const cityLine = [s.postalCode, s.city].filter(Boolean).join(' ');
        const oibLine = s.oib ? `OIB: ${s.oib}` : '';
        const noteLine = s.dodatneInformacije || '';

        const detailsWidth = 340;
        const detailsX = margin;
        const detailsY = 50;
        doc.font('Display').fontSize(12).fillColor('#000').text(`${schoolTitle}`, detailsX, detailsY, { width: detailsWidth, align: 'left' });
        doc.font('Body').fontSize(11).fillColor('#000');
        if (addrLine) doc.text(addrLine, detailsX, doc.y, { width: detailsWidth });
        if (cityLine) doc.text(cityLine, detailsX, doc.y, { width: detailsWidth });
        if (oibLine) doc.text(oibLine, detailsX, doc.y, { width: detailsWidth });
        if (noteLine) doc.text(`${noteLine}`, detailsX, doc.y, { width: detailsWidth });

        // Title and divider (moved down like single)
        doc.moveTo(margin, 260).lineTo(pageWidth - margin, 260).strokeColor('#e0e0e0').stroke();
        doc.font('DisplayBold').fontSize(22).text('POTVRDA O UPISU', margin, 230, { width: pageWidth - margin * 2, align: 'center' });

        // Sentence with emphasis
        const now = new Date();
        const adresa = user?.adresa ? `${user.adresa.ulica || ''} ${user.adresa.kucniBroj || ''}, ${user.adresa.mjesto || ''}`.trim() : '';
        const programs = Array.isArray(user.programs) ? user.programs : [];
        const programList = programs.length > 0 ? programs.map(p => p.naziv).join(', ') : 'Nije dodijeljeno';
        const fullName = [user.ime, user.prezime].filter(Boolean).join(' ');
        const oibPart = user.oib ? `, OIB ${user.oib}` : '';
        const addressPart = adresa ? `, ${adresa}` : '';
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const y1 = month >= 9 ? year : year - 1;
        const y2 = month >= 9 ? year + 1 : year;
        const schoolYearFormatted = `${y1}./${y2}.`;
        doc.font('Display').fontSize(12).fillColor('#000').text('Ovim se potvrđuje da je ', margin, 280, { width: pageWidth - margin * 2, continued: true });
        doc.font('Body').fillColor('#333').text(fullName, { continued: true });
        if (user.oib) {
          doc.font('Display').fillColor('#000').text(' (OIB: ', { continued: true });
          doc.font('Body').fillColor('#333').text(String(user.oib), { continued: true });
          doc.font('Display').fillColor('#000').text(')', { continued: true });
        }
        if (adresa) {
          doc.font('Display').fillColor('#000').text(', s prebivalištem na adresi ', { continued: true });
          doc.font('Body').fillColor('#333').text(adresa, { continued: true });
        }
        doc.font('Display').fillColor('#000').text(', upisan u program ', { continued: true });
        doc.font('Body').fillColor('#333').text(programList, { continued: true });
        doc.font('Display').fillColor('#000').text(' za školsku godinu ', { continued: true });
        doc.font('Body').fillColor('#333').text(schoolYearFormatted);

        // Signature (moved down)
        doc.moveDown(4);
        const sigWidth = 240;
        const sigX = pageWidth - margin - sigWidth;
        const sigY = doc.y + 50;
        doc.text('_______________________________', sigX, sigY, { width: sigWidth, align: 'center' });
        doc.font('Body').fontSize(10).fillColor('#666').text('Ravnatelj / odgovorna osoba', sigX, sigY + 15, { width: sigWidth, align: 'center' });

        // Dates and confirmation number
        const acceptedAt = enrollment?.agreementAcceptedAt ? new Date(enrollment.agreementAcceptedAt) : null;
        const datumUpisa = acceptedAt ? acceptedAt.toLocaleDateString('hr-HR') : '-';
        const datumIzdavanja = now.toLocaleDateString('hr-HR');
        doc.font('Body').fontSize(11).fillColor('#000')
          .text(`Datum upisa: ${datumUpisa}`, margin, pageHeight - margin - 60, { align: 'left' })
          .text(`Datum izdavanja potvrde: ${datumIzdavanja}`, margin, pageHeight - margin - 45, { align: 'left' });

        // Divider and footer
        doc.moveTo(margin, pageHeight - margin - 28).lineTo(pageWidth - margin, pageHeight - margin - 28).strokeColor('#e0e0e0').stroke();
        // Unique confirmation number based on enrollment acceptance time: YYYYMMDDHHmmss-userId[-enrollmentId]
        const ts = acceptedAt || now;
        const dateStr = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
        const baseConf = `${dateStr}-${String(user.id || 0)}`;
        const confStr = enrollment?.id ? `${baseConf}-${String(enrollment.id)}` : baseConf;
        doc.font('Body').fontSize(10).fillColor('#333').text(`Potvrda br. ${confStr}`, margin, pageHeight - margin - 45, { align: 'right', width: pageWidth - margin * 2 });
        doc.fontSize(9).fillColor('#666').text('Potvrda je generirana elektroničkim putem.', margin, pageHeight - margin - 20, { align: 'center', width: pageWidth - margin * 2 });
      };

      entries.forEach((entry, idx) => renderOne(entry.user, entry.invoiceSettings, entry.enrollment, idx === 0));

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};