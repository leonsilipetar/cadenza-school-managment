import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Icon } from '@iconify/react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import Navigacija from './navigacija/index';
import NavTop from './nav-top/index';
import ApiConfig from '../components/apiConfig';
import RenderPDF from '../components/RenderPDF';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { showNotification } from '../components/Notifikacija';
import LoadingShell from '../components/LoadingShell';
import GenerateInvoiceModal from '../components/GenerateInvoiceModal';
import Modal from '../components/Modal';

// Update the UploadInvoiceModal component to match the MongoDB version
const UploadInvoiceModal = ({ onUpload, onCancel, selectedFile, setSelectedFile }) => (
  <Modal
    isOpen={true}
    onClose={onCancel}
    title={
      <>
        <Icon icon="solar:upload-broken" />
        Učitaj PDF račun
      </>
    }
    maxWidth="600px"
    isFormModal={true}
  >
    <form onSubmit={onUpload}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label htmlFor="pdf-file" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Odaberi PDF datoteku <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="pdf-file"
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              console.log('File selected:', file);
              setSelectedFile(file || null);
            }}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid rgba(var(--isticanje2), 0.3)',
              borderRadius: 'var(--radius)',
              background: 'rgba(var(--isticanje2), 0.05)',
              cursor: 'pointer'
            }}
          />
          {selectedFile && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(var(--isticanje), 0.1)',
              border: '1px solid rgba(var(--isticanje), 0.3)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Icon icon="solar:file-check-broken" style={{ fontSize: '1.5rem', color: 'rgb(var(--isticanje))' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Odabrana datoteka:</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{selectedFile.name}</div>
              </div>
            </div>
          )}
        </div>

        <div className="div-radio">
          <button
            type="button"
            className="gumb action-btn zatvoriBtn"
            onClick={onCancel}
          >
            <Icon icon="solar:close-circle-broken" /> Odustani
          </button>
          <button
            type="submit"
            className="gumb action-btn spremiBtn"
            disabled={!selectedFile}
          >
            <Icon icon="solar:upload-broken" /> Učitaj
          </button>
        </div>
      </div>
    </form>
  </Modal>
);

const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const getDecodedFileName = (invoice) => {
  try {
    let fileName;
    if (typeof invoice.pdfData === 'string') {
      const pdfDataObj = JSON.parse(invoice.pdfData);
      fileName = pdfDataObj.originalName;
    } else {
      fileName = invoice.pdfData?.originalName || invoice.pdfOriginalName;
    }

    // Return default name if no filename exists
    if (!fileName) {
      return `Racun-${invoice.invoiceNumber}.pdf`;
    }

    // Try to decode, if fails return the original
    try {
      return decodeURIComponent(escape(fileName));
    } catch (e) {
      console.warn('Could not decode filename:', e);
      return fileName;
    }
  } catch (e) {
    console.warn('Error getting filename:', e);
    return `Racun-${invoice.invoiceNumber}.pdf`;
  }
};

const generateInvoiceNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${year}${month}${random}`;
};

const calculateDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
};

const Racuni = ({ user, unreadChatsCount }) => {
  const [invoices, setInvoices] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [school, setSchool] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const otvoreno = 'racuni';
  const [selectedType, setSelectedType] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedStudentInvoices, setSelectedStudentInvoices] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteInvoice, setDeleteInvoice] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);
  const [currentProgram, setCurrentProgram] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [mentorStudents, setMentorStudents] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch common data
        const [schoolRes, programsRes] = await Promise.all([
          ApiConfig.api.get('/api/schools'),
          ApiConfig.api.get('/api/programs')
        ]);

        if (isMounted) {
          setSchool(schoolRes.data);
          setPrograms(programsRes.data);

          // Student-specific data
          if (user.isStudent) {
            const invoicesRes = await ApiConfig.api.get(`/api/invoices/students-invoices/${user.id}`);
            if (isMounted) {
              setInvoices(invoicesRes.data);
            }
          }

          // Mentor-specific data
          if (user.isMentor) {
            const mentorRes = await ApiConfig.api.get('/api/mentors/students');
            if (isMounted && Array.isArray(mentorRes.data)) {
              setMentorStudents(mentorRes.data);
            }
          }
        }
      } catch (error) {
        if (!axios.isCancel(error) && isMounted) {
          console.error('Error fetching data:', error);
          showNotification('error', 'Greška pri dohvaćanju podataka');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [user?.id]);

  // Separate effect for invoice settings
  useEffect(() => {
    let isMounted = true;

    const fetchInvoiceSettings = async () => {
      try {
        const response = await ApiConfig.api.get('/api/invoice-settings');
        if (isMounted) {
          setInvoiceSettings(response.data || {
            paymentDue: 30,
            paymentMethod: 'Transakcijski račun',
            iban: 'HR1234567890123456789',
            defaultNote: 'Hvala na povjerenju!'
          });
        }
      } catch (error) {
        if (!axios.isCancel(error) && isMounted) {
          console.error('Error fetching invoice settings:', error);
          setInvoiceSettings({
            paymentDue: 30,
            paymentMethod: 'Transakcijski račun',
            iban: 'HR1234567890123456789',
            defaultNote: 'Hvala na povjerenju!'
          });
        }
      }
    };

    fetchInvoiceSettings();
    return () => { isMounted = false; };
  }, []);

  const handleNewInvoice = (student) => {
    if (!student.program || student.program.length === 0) {
      showNotification('error', 'Učenik nema dodijeljen program');
      return;
    }

    const studentProgram = student.program[0];
    const savedProgramType = student.programType?.[studentProgram.id];
    const typeData = savedProgramType ?
      studentProgram.tipovi.find(t => t.tip === savedProgramType) :
      null;

    const formattedAddress = student.adresa ?
      `${student.adresa.ulica} ${student.adresa.kucniBroj}, ${student.adresa.mjesto}` :
      '';

    const invoiceData = {
      studentId: student.id,
      programId: studentProgram.id,
      schoolId: student.schoolId,
      mentorId: user.id,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      amount: typeData?.cijena || 0,
      programType: savedProgramType || '',
      invoiceNumber: generateInvoiceNumber(),
      dueDate: calculateDueDate(),
      studentData: {
        ime: student.ime,
        prezime: student.prezime,
        oib: student.oib || '',
        adresa: formattedAddress,
        email: student.email
      }
    };

    setPreviewInvoice(invoiceData);
    setCurrentStudent({...student, formattedAddress});
    setCurrentProgram(studentProgram);
    setSelectedType(savedProgramType || '');
    setShowGenerateModal(true);
  };

  const handleProgramTypeSelect = (type) => {
    if (!currentProgram?.tipovi) return;

    const typeData = currentProgram.tipovi.find(t => t.tip === type);
    if (typeData) {
      setSelectedType(type);
      setPreviewInvoice(prev => ({
        ...prev,
        amount: typeData.cijena
      }));
    }
  };

  const handleGenerateInvoice = async (formData) => {
    try {
      const schoolId = currentStudent?.schoolId || user?.schoolId;

      if (!schoolId) {
        throw new Error('School ID is required');
      }

      const currentDate = new Date();
      const invoiceData = {
        studentId: currentStudent.id,
        programId: currentProgram.id,
        schoolId: schoolId,
        amount: previewInvoice.amount,
        mentorId: user.id,
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      };

      // Create a new FormData instance
      const form = new FormData();

      // Add the PDF file
      form.append('pdfFile', formData.get('pdfFile'));

      // Add the invoice data
      form.append('invoiceData', JSON.stringify(invoiceData));

      const response = await ApiConfig.api.post(
        '/api/invoices/generate',
        form,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data) {
        showNotification('success', 'Račun uspješno generiran');

        if (selectedStudentInvoices) {
          await fetchStudentInvoices(selectedStudentInvoices.student.id);
        }

        setShowGenerateModal(false);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      showNotification('error', error.response?.data?.message || 'Greška pri generiranju računa');
    }
  };

  const openUploadModal = (student) => {
    setSelectedStudentInvoices({
      student: student,
      invoices: []
    });
    setShowUploadModal(true);
  };

  const handleUploadInvoice = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('studentId', selectedStudentInvoices.student.id);
    formData.append('pdfFile', selectedFile);

    try {
      const response = await ApiConfig.api.post(
        '/api/invoices/upload-pdf-invoice',
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        }
      );

      if (response.data) {
        showNotification('success', 'Račun uspješno učitan');
        setShowUploadModal(false);
        setSelectedFile(null);
        fetchStudentInvoices(selectedStudentInvoices.student.id);
      }
    } catch (error) {
      console.error('Error uploading invoice:', error);
      showNotification('error', 'Greška pri učitavanju računa');
    }
  };

  const handleCancelUpload = useCallback(() => {
    setShowUploadModal(false);
  }, []);

  const handleViewPdf = (invoice) => {
    if (!invoice.pdfData) return;

    try {
      let pdfDataObj = invoice.pdfData;
      if (typeof invoice.pdfData === 'string') {
        pdfDataObj = JSON.parse(invoice.pdfData);
      }

      // Create a Uint8Array directly from the data
      const pdfBuffer = new Uint8Array(pdfDataObj.data.data);
      const blob = new Blob([pdfBuffer], { type: pdfDataObj.contentType || 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Open in new window
      window.open(url, '_blank');

      // Clean up the URL object after opening
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.error('Error handling PDF:', e);
      showNotification('error', 'Greška pri otvaranju PDF-a');
    }
  };

  const fetchStudentInvoices = async (studentId) => {
    try {
      const response = await ApiConfig.api.get(`/api/invoices/student/${studentId}`);
      const student = mentorStudents.find(s => s.id === studentId);
      if (!student) throw new Error('Student not found');

      setSelectedStudentInvoices({
        student,
        invoices: response.data
      });
    } catch (error) {
      console.error('Error fetching student invoices:', error);
      showNotification('error', 'Greška pri dohvaćanju računa');
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    try {
      await ApiConfig.api.delete(`/api/invoices/delete/${invoiceId}`);

      // Refresh the invoices list after deletion
      if (selectedStudentInvoices) {
        await fetchStudentInvoices(selectedStudentInvoices.student.id);
      }

      showNotification('success', 'Račun uspješno obrisan');

      setDeleteInvoice(null); // Close the confirmation dialog
    } catch (error) {
      console.error('Error deleting invoice:', error);
      showNotification('error', 'Greška prilikom brisanja računa');
    }
  };

  // For file upload with form data
  const generateInvoice = async (invoiceData, file) => {
    try {
      const form = new FormData();
      if (file) {
        form.append('file', file);
      }
      form.append('invoiceData', JSON.stringify(invoiceData));

      const response = await ApiConfig.api.post('/api/invoices/generate',
        form,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  };

  // For regular API calls
  const fetchInvoices = async () => {
    try {
      const response = await ApiConfig.api.get('/api/invoices');
      setInvoices(response.data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      showNotification('error', 'Greška pri dohvaćanju računa');
    }
  };

  const downloadInvoice = async (invoiceId) => {
    try {
      const response = await ApiConfig.api.get(`/api/invoices/download/${invoiceId}`, {
        responseType: 'blob'
      });

      // Handle file download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading invoice:', error);
      showNotification('error', 'Greška pri preuzimanju računa');
    }
  };

  return (
    <div className="racuni-container">
      <Navigacija user={user} otvoreno={otvoreno} unreadChatsCount={unreadChatsCount} />
      <NavTop user={user} naslov={"Računi"} />
      <div className="main">
        {isLoading ? (
          <LoadingShell />
        ) : (
          <>
            {user?.isMentor && (
              <div className='karticaZadatka'>
                <div className="tablica">
                  <div className="tr naziv">
                    <div className="th">Učenik</div>
                    <div></div>
                  </div>
                  {Array.isArray(mentorStudents) && mentorStudents.map((student) => (
                    <div key={student.id} className={`tr redak ${isHovered ? 'hovered' : ''}`}>
                      <div className="th">
                        {student.ime} {student.prezime}
                      </div>
                      <div className="th">
                        <button
                          className="gumb action-btn"
                          onClick={() => fetchStudentInvoices(student.id)}
                        >
                          <Icon icon="solar:document-broken" /> Računi
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {user && user.isStudent && (
              <>
                {user.hasUnpaidInvoice && (
                  <div className="karticaZadatka" style={{backgroundColor: 'rgba(var(--crvena), 0.3)'}}>
                    <p style={{color: 'rgb(var(--crvena))', padding: '0.5rem 0.8rem', borderRadius: 'var(--radius)'}}>Niste platili sve račune</p>
                    <p style={{fontSize: '0.7rem'}}>Od uplate do ažuriranja podataka o uplati može proći više dana!</p>
                  </div>
                )}

                <div className='karticaZadatka'>
                  <div className="tablica">
                    <div className="tr naziv">
                      <div className="th">Račun</div>
                      <div></div>
                    </div>
                      {Array.isArray(invoices) && invoices.length > 0 ? (
                      invoices.map((invoice) => (
                        <div className="tr redak" key={invoice.id || invoice._id || `${invoice.invoiceNumber}-${invoice.month}-${invoice.year}`}>
                          <div className="th">Račun br. {invoice.invoiceNumber}</div>
                          <div className="th">{invoice.month}/{invoice.year}</div>
                          <div className="th mobile-none">{invoice.amount} EUR</div>
                          <div className="th">
                            <button
                              onClick={() => handleViewPdf(invoice)}
                              className="gumb action-btn spremiBtn"
                            >
                              <Icon icon="solar:eye-broken" /> Pregledaj
                            </button>
                            <a
                              href={`data:application/pdf;base64,${
                                typeof invoice.pdfData === 'string'
                                  ? arrayBufferToBase64(JSON.parse(invoice.pdfData).data.data)
                                  : arrayBufferToBase64(invoice.pdfData.data.data)
                              }`}
                              download={getDecodedFileName(invoice)}
                              className="gumb action-btn"
                            >
                              <Icon icon="solar:file-download-broken" /> Preuzmi
                            </a>
                          </div>
                        </div>

                      ))
                    ) : (
                      <p>Nema dostupnih računa.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showGenerateModal && (
        <GenerateInvoiceModal
          student={currentStudent}
          program={currentProgram}
          invoiceSettings={invoiceSettings}
          previewInvoice={previewInvoice}
          handleProgramTypeSelect={handleProgramTypeSelect}
          selectedType={selectedType}
          onGenerate={handleGenerateInvoice}
          onCancel={() => setShowGenerateModal(false)}
        />
      )}

      {selectedInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvoice(null)}
          title={
            <>
              <Icon icon="solar:document-text-broken" />
              Pregled računa
            </>
          }
          maxWidth="900px"
          isFormModal={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <RenderPDF
              invoice={selectedInvoice}
              school={school}
              student={user.isStudent ? user : selectedInvoice.student}
              program={programs.find(p => p._id === selectedInvoice.programId)}
            />
          </div>
        </Modal>
      )}

      {showUploadModal && (
        <UploadInvoiceModal
          onUpload={handleUploadInvoice}
          onCancel={handleCancelUpload}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
        />
      )}

      {selectedStudentInvoices && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedStudentInvoices(null)}
          title={
            <>
              <Icon icon="solar:bill-list-broken" />
              Računi - {selectedStudentInvoices.student.ime} {selectedStudentInvoices.student.prezime}
            </>
          }
          maxWidth="900px"
          isFormModal={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="gumb action-btn"
                onClick={() => handleNewInvoice(selectedStudentInvoices.student)}
              >
                <Icon icon="solar:plus-circle-broken" /> Novi račun
              </button>
              <button
                className="gumb action-btn spremiBtn"
                onClick={() => {
                  openUploadModal(selectedStudentInvoices.student);
                }}
              >
                <Icon icon="solar:upload-broken" /> Učitaj
              </button>
            </div>

            {/* Invoices List */}
            {selectedStudentInvoices.invoices.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedStudentInvoices.invoices.map((invoice) => (
                  <div
                    key={invoice.id || invoice._id || `${invoice.invoiceNumber}-${invoice.createdAt || ''}`}
                    style={{
                      background: 'rgba(var(--isticanje2), 0.05)',
                      border: '1px solid rgba(var(--isticanje2), 0.2)',
                      borderRadius: 'var(--radius)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    {/* Invoice Info */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ flex: '1 1 150px' }}>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Broj računa</div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{invoice.invoiceNumber}</div>
                      </div>
                      <div style={{ flex: '1 1 150px' }}>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Datum</div>
                        <div style={{ fontWeight: 600 }}>
                          {new Date(invoice.createdAt).toLocaleDateString('hr-HR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {invoice.pdfData ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleViewPdf(invoice)}
                          className="gumb action-btn"
                        >
                          <Icon icon="solar:eye-broken" /> Pregledaj
                        </button>
                        <a
                          href={`data:application/pdf;base64,${
                            typeof invoice.pdfData === 'string'
                              ? arrayBufferToBase64(JSON.parse(invoice.pdfData).data.data)
                              : arrayBufferToBase64(invoice.pdfData.data.data)
                          }`}
                          download={getDecodedFileName(invoice)}
                          className="gumb action-btn"
                        >
                          <Icon icon="solar:file-download-broken" /> Preuzmi
                        </a>
                        <button
                          onClick={() => setDeleteInvoice(invoice)}
                          className="gumb action-btn abDelete"
                        >
                          <Icon icon="solar:trash-bin-trash-broken" /> Obriši
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: '0.5rem', color: 'red', fontSize: '0.9rem' }}>
                        PDF nije dostupan
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                background: 'rgba(var(--isticanje2), 0.05)',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(var(--isticanje2), 0.2)'
              }}>
                <Icon icon="solar:bill-cross-broken" style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                <p style={{ margin: 0, opacity: 0.7 }}>Nema dostupnih računa.</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      {user && user.isMentor && deleteInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteInvoice(null)}
          title={
            <>
              <Icon icon="solar:danger-triangle-broken" />
              Potvrda brisanja
            </>
          }
          maxWidth="500px"
          isFormModal={true}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{
              padding: '1rem',
              background: 'rgba(220, 53, 69, 0.1)',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              borderRadius: 'var(--radius)',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '1rem' }}>
                Jeste li sigurni da želite obrisati račun <strong>{deleteInvoice.invoiceNumber}</strong>?
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
                Ova akcija se ne može poništiti.
              </p>
            </div>

            <div className="div-radio">
              <button
                className="gumb action-btn zatvoriBtn"
                onClick={() => setDeleteInvoice(null)}
                type="button"
              >
                <Icon icon="solar:close-circle-broken" /> Odustani
              </button>
              <button
                className="gumb action-btn abDelete"
                onClick={() => handleDeleteInvoice(deleteInvoice.id)}
                type="button"
              >
                <Icon icon="solar:trash-bin-trash-broken" /> Obriši
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Racuni;