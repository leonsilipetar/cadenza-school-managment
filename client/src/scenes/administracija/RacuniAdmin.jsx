import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Icon } from '@iconify/react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import NavigacijaAdmin from './NavigacijaAdmin';
import NavTopAdministracija from './NavTopAdmin.jsx';
import DodajRacun from './DodajRacun';
import RenderPDF from '../../components/RenderPDF';
import ApiConfig from '../../components/apiConfig';
import InvoiceSettings from './InvoiceSettings';
import Notifikacija from '../../components/Notifikacija';
import LoadingShell from '../../components/LoadingShell';
import './RacuniAdmin.css';

const RacuniAdmin = () => {
  const [odabranoDodajRacun, setOdabranoDodajRacun] = useState(false);
  const [racuni, setRacuni] = useState([]);
  const [students, setStudents] = useState([]);
  const [schools, setSchools] = useState([]);
  const [school, setSchool] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showInvoiceSettings, setShowInvoiceSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const otvoreno = 'racuni';
  const [sortField, setSortField] = useState('month');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRacuni, setFilteredRacuni] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [limit] = useState(50);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [programs, setPrograms] = useState([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [userSchoolId, setUserSchoolId] = useState(null);
  const [showConfirmGenerate, setShowConfirmGenerate] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedStatusFile, setSelectedStatusFile] = useState(null);
  const [showStatusUpload, setShowStatusUpload] = useState(false);
  const [showBulkGenerate, setShowBulkGenerate] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [studentInput, setStudentInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [generationMode, setGenerationMode] = useState('all'); // 'all' or 'selected'
  const [showMobileActionsMenu, setShowMobileActionsMenu] = useState(false);

  // Add months array for the dropdown
  const months = [
    { value: 1, label: 'Siječanj' },
    { value: 2, label: 'Veljača' },
    { value: 3, label: 'Ožujak' },
    { value: 4, label: 'Travanj' },
    { value: 5, label: 'Svibanj' },
    { value: 6, label: 'Lipanj' },
    { value: 7, label: 'Srpanj' },
    { value: 8, label: 'Kolovoz' },
    { value: 9, label: 'Rujan' },
    { value: 10, label: 'Listopad' },
    { value: 11, label: 'Studeni' },
    { value: 12, label: 'Prosinac' }
  ];

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [schoolRes, studentsRes, programsRes, userRes] = await Promise.all([
        ApiConfig.api.get('/api/schools'),
        ApiConfig.api.get('/api/korisnici-osnovno'),
        ApiConfig.api.get('/api/programs'),
        ApiConfig.api.get('/api/profil')  // Get user profile to get school ID
      ]);

      setSchools(schoolRes.data);
      setSchool(schoolRes.data[0]);
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
      setPrograms(Array.isArray(programsRes.data) ? programsRes.data : []);

      // Set the user's school ID
      if (userRes.data && userRes.data.user && userRes.data.user.schoolId) {
        setUserSchoolId(userRes.data.user.schoolId);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setNotification({
        type: 'error',
        message: 'Greška pri dohvaćanju podataka'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvoiceSettings = async () => {
    try {
      setIsLoadingSettings(true);
      const response = await ApiConfig.api.get('/api/invoice-settings');
      if (response.data) {
        setInvoiceSettings(response.data);
      } else {
        setNotification({
          type: 'info',
          message: 'Nema postavljenih postavki računa za vašu školu'
        });
      }
    } catch (err) {
      console.error('Error fetching invoice settings:', err);
      setNotification({
        type: 'error',
        message: 'Greška pri dohvaćanju postavki računa'
      });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const fetchInvoices = async (page = currentPage) => {
    try {
      setIsLoadingInvoices(true);

      // Only fetch if we have the user's school ID
      if (!userSchoolId) {
        throw new Error('School ID not available');
      }

      const response = await ApiConfig.api.get(`/api/invoices?page=${page}&limit=${limit}&schoolId=${userSchoolId}`);

      if (response.data && response.data.invoices) {
        const { invoices, pagination } = response.data;
        setRacuni(invoices);
        setFilteredRacuni(invoices);
        setTotalPages(pagination.totalPages || 1);
        setTotalInvoices(pagination.total || 0);
        setCurrentPage(pagination.currentPage || 1);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setNotification({
        type: 'error',
        message: 'Greška pri dohvaćanju računa'
      });
      setRacuni([]);
      setFilteredRacuni([]);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  useEffect(() => {
    // First load invoice settings and schools
    Promise.all([fetchInvoiceSettings(), fetchData()]);
  }, []);

  // After settings are loaded, load invoices
  useEffect(() => {
    if (!isLoadingSettings && invoiceSettings && userSchoolId) {
      fetchInvoices(1);
    }
  }, [isLoadingSettings, invoiceSettings, userSchoolId]);

  // Add useEffect for notification cleanup
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000); // Clear notification after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleGenerateInvoice = async (data) => {
    try {
      await ApiConfig.api.post('/api/invoices/generate', data);
      await fetchData(); // Refresh all data
      setOdabranoDodajRacun(false);
      setNotification({
        type: 'success',
        message: 'Račun uspješno generiran'
      });
    } catch (err) {
      console.error("Error generating invoice:", err);
      setNotification({
        type: 'error',
        message: 'Greška pri generiranju računa'
      });
    }
  };

  const sendRequestRacuni = async () => {
    try {
      const res = await ApiConfig.api.get('/api/invoices');
      return res.data;
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Greška pri dohvaćanju računa'
      });
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    try {
      setNotification(null); // Clear existing notification
      await ApiConfig.api.delete(`/api/invoices/delete/${invoiceId}`);
      // Refresh the invoices list after deletion
      await fetchInvoices(currentPage);
      setNotification({
        type: 'success',
        message: 'Račun uspješno obrisan'
      });
      setDeleteConfirmation(null); // Close the confirmation dialog
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Greška pri brisanju računa'
      });
    }
  };

  const handleDownloadInvoice = async (invoiceId) => {
    try {
      const response = await ApiConfig.api.get(`/api/invoices/download/${invoiceId}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Greška pri preuzimanju računa'
      });
    }
  };

  const handleUploadInvoice = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      await ApiConfig.api.post('/api/invoices/upload-pdf-invoice', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Refresh the invoices list after upload
      const updatedInvoices = await sendRequestRacuni();
      setRacuni(updatedInvoices);
      setNotification({
        type: 'success',
        message: 'Račun uspješno učitan'
      });
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Greška pri učitavanju računa'
      });
    }
  };

  const handleAddInvoiceClick = () => {
    setShowBulkGenerate(true);
  };

  const handleSettingsSaved = () => {
    setShowSettings(false);
    setOdabranoDodajRacun(true);
  };

  const handleInvoiceSettingsSave = async (settingsData) => {
    try {
      setNotification(null); // Clear existing notification
      const response = await ApiConfig.api.post('/api/invoice-settings', settingsData);
      if (response.data) {
        setShowInvoiceSettings(false);
        setNotification({
          type: 'success',
          message: 'Postavke računa uspješno spremljene'
        });
        await fetchInvoiceSettings();
      }
    } catch (error) {
      console.error('Error saving invoice settings:', error);
      const errorMessage = error.response?.data?.message || 'Greška pri spremanju postavki računa';
      setNotification({
        type: 'error',
        message: errorMessage
      });
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value || '';
    setStudentInput(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await ApiConfig.api.get('/api/users', {
        params: { searchTerm: query }
      });

      if (res.data) {
        const students = Array.isArray(res.data) ? res.data : res.data || [];
        const mappedResults = students
          .filter(student => student && student.isStudent)
          .map(student => ({
            ...student,
            isSelected: selectedStudents.some(s => s.id === student.id)
          }));
        setSearchResults(mappedResults);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  const handleAddStudent = (student) => {
    if (!selectedStudents.some(s => s.id === student.id)) {
      setSelectedStudents(prev => [...prev, student]);
      setSearchResults(prev =>
        prev.map(s => s.id === student.id ? { ...s, isSelected: true } : s)
      );
    }
    setStudentInput('');
  };

  const handleRemoveStudent = (studentId) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== studentId));
    setSearchResults(prev =>
      prev.map(s => s.id === studentId ? { ...s, isSelected: false } : s)
    );
  };

  const handleBulkGenerate = async () => {
    try {
      if (!selectedType) {
        setNotification({
          type: 'error',
          message: 'Molimo odaberite tip dokumenta'
        });
        return;
      }

      setNotification(null);
      setGenerating(true);
      setProgress(0);
      setShowProgress(true);
      setProgressMessage('Započinjem generiranje...');

      const endpoint = generationMode === 'all' ? '/api/invoices/generate-bulk' : '/api/invoices/generate-selected';
      const requestData = {
        type: selectedType,
        documentType: selectedType,
        ...(generationMode === 'selected' && {
          studentIds: selectedStudents.map(s => s.id)
        })
      };

      const response = await ApiConfig.api.post(endpoint, requestData);

      const { results, summary } = response.data;

      // Format detailed results message
      let detailedMessage = `Generirano ${summary.success} od ${summary.total} ${selectedType === 'članarina' ? 'članarina' : 'računa'}\n`;
      detailedMessage += `Ukupni iznos: ${summary.totalAmount.toFixed(2)} EUR\n\n`;

      // Add successful generations
      const successfulResults = results.filter(r => r.status === 'success');
      if (successfulResults.length > 0) {
        detailedMessage += 'Uspješno generirano za:\n';
        successfulResults.forEach(r => {
          detailedMessage += `✓ ${r.studentName} - ${r.amount.toFixed(2)} EUR\n`;
          r.programs.forEach(p => {
            // Get the program type from student's programType object
            const studentProgramType = r.student?.programType?.[p.id];
            const programType = studentProgramType === 'none' ? '' : studentProgramType || '';

            // Find the price info based on the program type
            const priceInfo = p.tipovi?.find(t => t.tip === (programType || 'none'));

            if (priceInfo) {
              detailedMessage += `  • ${p.naziv}${programType ? ` (${programType})` : ''}: ${priceInfo.cijena.toFixed(2)} EUR\n`;
            } else {
              detailedMessage += `  • ${p.naziv}${programType ? ` (${programType})` : ''}: Cijena nije definirana\n`;
            }
          });
        });
      }

      // Add errors
      const errorResults = results.filter(r => r.status === 'error');
      if (errorResults.length > 0) {
        detailedMessage += '\nGreške:\n';
        errorResults.forEach(r => {
          if (r.message.includes('tip nije odabran')) {
            detailedMessage += `✗ ${r.studentName}: Molimo odaberite tip programa za ${r.programName}\n`;
          } else {
            detailedMessage += `✗ ${r.studentName}: ${r.message}\n`;
          }
        });
      }

      setProgressMessage(detailedMessage);
      setNotification({
        type: summary.success > 0 ? 'success' : 'error',
        message: `Generirano ${summary.success} od ${summary.total} ${selectedType === 'članarina' ? 'članarina' : 'računa'}`
      });

      // Close the generation dialog and refresh data
      if (summary.success > 0) {
        setTimeout(() => {
          setShowBulkGenerate(false);
          setSelectedType('');
          setSelectedStudents([]);
          setGenerationMode('all');
          fetchInvoices(currentPage);
        }, 5000); // Give user time to read the results
      }
    } catch (error) {
      console.error('Error generating bulk invoices:', error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message || `Greška pri generiranju ${selectedType === 'članarina' ? 'članarina' : 'računa'}`
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSort = (field) => {
    if (!filteredRacuni || !Array.isArray(filteredRacuni)) return;

    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);

    const sortedRacuni = [...filteredRacuni].sort((a, b) => {
      if (!a || !b) return 0;

      if (field === 'month') {
        const dateA = new Date(a.year || 0, (a.month || 1) - 1);
        const dateB = new Date(b.year || 0, (b.month || 1) - 1);
        return newDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (field === 'amount') {
        const amountA = parseFloat(a.amount) || 0;
        const amountB = parseFloat(b.amount) || 0;
        return newDirection === 'asc' ? amountA - amountB : amountB - amountA;
      }
      // For string fields
      const valueA = ((a[field] || '')).toString().toLowerCase();
      const valueB = ((b[field] || '')).toString().toLowerCase();
      return newDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    });

    setFilteredRacuni(sortedRacuni);
  };

  const handleSearchInvoices = (term) => {
    setSearchTerm(term);
    if (!racuni || !Array.isArray(racuni)) {
      setFilteredRacuni([]);
      return;
    }

    const filtered = racuni.filter(racun => {
      if (!racun) return false;

      const searchTermLower = term.toLowerCase();
      return (
        (racun.invoiceNumber || '').toLowerCase().includes(searchTermLower) ||
        ((racun.student?.ime || '') + ' ' + (racun.student?.prezime || '')).toLowerCase().includes(searchTermLower)
      );
    });
    setFilteredRacuni(filtered);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchInvoices(newPage);
    }
  };

  const handleProgramFilterChange = (e) => {
    const programId = e.target.value;
    setSelectedProgram(programId);
    applyFilters(selectedSchool, selectedMonth, programId);
  };

  const handleSchoolFilterChange = (e) => {
    const schoolId = e.target.value;
    setSelectedSchool(schoolId);
    applyFilters(schoolId, selectedMonth, selectedProgram);
  };

  const handleMonthFilterChange = (e) => {
    const month = e.target.value;
    setSelectedMonth(month);
    applyFilters(selectedSchool, month, selectedProgram);
  };

  const applyFilters = (schoolId, month, programId) => {
    if (!racuni || !Array.isArray(racuni)) {
      setFilteredRacuni([]);
      return;
    }

    let filtered = [...racuni];

    // Apply school filter
    if (schoolId) {
      filtered = filtered.filter(racun =>
        racun.schoolId === parseInt(schoolId)
      );
    }

    // Apply month filter
    if (month) {
      filtered = filtered.filter(racun =>
        racun.month === parseInt(month)
      );
    }

    // Apply program filter
    if (programId) {
      filtered = filtered.filter(racun =>
        racun.programId === parseInt(programId)
      );
    }

    setFilteredRacuni(filtered);
  };

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

      window.open(url, '_blank');

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.error('Error handling PDF:', e);
      setNotification({
        type: 'error',
        message: 'Greška pri otvaranju PDF-a'
      });
    }
  };

  const handleStatusUpload = async () => {
    try {
      if (!selectedStatusFile) {
        setNotification({
          type: 'error',
          message: 'Molimo odaberite XLSX datoteku'
        });
        return;
      }

      setNotification(null);
      setGenerating(true);
      setProgress(0);
      setShowProgress(true);
      setProgressMessage('Započinjem ažuriranje statusa računa...');

      const formData = new FormData();
      formData.append('file', selectedStatusFile);

      const response = await ApiConfig.api.post('/api/invoices/update-status', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
          setProgressMessage(`Učitavanje XLSX-a: ${percentCompleted}%`);
        }
      });

      const { results } = response.data;

      // Calculate success and error counts
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      // Format notification message
      let message = `Ažurirano ${successCount} računa uspješno.`;
      if (errorCount > 0) {
        message += ` ${errorCount} računa ima greške.`;
        const errors = results.filter(r => r.status === 'error')
          .map(r => `OIB ${r.oib}: ${r.message}`)
          .join('\n');
        message += `\nGreške:\n${errors}`;
      }

      setProgressMessage(message);
      setNotification({
        type: successCount > 0 ? 'success' : 'error',
        message
      });

      // Close the upload dialog and refresh data
      setShowStatusUpload(false);
      setSelectedStatusFile(null);
      fetchInvoices(currentPage);
    } catch (error) {
      console.error('Error updating invoice statuses:', error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Greška pri ažuriranju statusa'
      });
    } finally {
      setGenerating(false);
      setShowProgress(false);
    }
  };

  const handleGenerateClick = () => {
    setShowConfirmGenerate(true);
  };

  const handleBulkPdfUpload = async () => {
    try {
      if (!selectedFile) {
        setNotification({
          type: 'error',
          message: 'Molimo odaberite PDF datoteku'
        });
        return;
      }

      setNotification(null);
      setGenerating(true);
      setProgress(0);
      setShowProgress(true);
      setProgressMessage('Započinjem učitavanje računa...');

      const formData = new FormData();
      formData.append('pdfFile', selectedFile);

      setProgressMessage('Učitavam i obrađujem PDF...');
      const response = await ApiConfig.api.post('/api/invoices/generate-bulk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
          setProgressMessage(`Učitavanje PDF-a: ${percentCompleted}%`);
        }
      });

      const { results } = response.data;

      // Calculate success and error counts
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      // Format notification message
      let message = `Obrađeno ${successCount} računa uspješno.`;
      if (errorCount > 0) {
        message += ` ${errorCount} računa ima greške.`;
        const errors = results.filter(r => r.status === 'error')
          .map(r => {
            if (r.oib) {
              return `OIB ${r.oib}: ${r.message}`;
            }
            return r.message;
          })
          .join('\n');
        message += `\nGreške:\n${errors}`;
      }

      setProgressMessage(message);

      // Show final notification
      setNotification({
        type: successCount > 0 ? 'success' : 'error',
        message
      });

      // Close the upload dialog
      setShowConfirmGenerate(false);
      setSelectedFile(null);

      // Refresh the invoice list
      fetchInvoices(currentPage);
    } catch (error) {
      console.error('Error processing bulk PDF:', error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Greška pri obradi PDF-a'
      });
    } finally {
      setGenerating(false);
      setShowProgress(false);
    }
  };

  if (isLoadingSettings) {
    return <LoadingShell />;
  }

  return (
    <>
      <NavigacijaAdmin otvoreno={otvoreno} />
      <NavTopAdministracija naslov={'Administracija - Računi'} />

      {showSettings && (
        <InvoiceSettings
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSaved}
        />
      )}

      {showInvoiceSettings && (
          <InvoiceSettings
            onClose={() => setShowInvoiceSettings(false)}
            onSave={handleInvoiceSettingsSave}
            currentSettings={invoiceSettings}
          />
      )}

      {selectedInvoice && (
        <div className="popup" onClick={() => setSelectedInvoice(null)}>
          <div className="div div-clmn" onClick={e => e.stopPropagation()}>
            <div className="div-radio">
              <h3>Pregled računa</h3>
              <button
                className="gumb action-btn zatvoriBtn"
                onClick={() => setSelectedInvoice(null)}
              >
                <Icon icon="solar:close-circle-broken" />
              </button>
            </div>
            <div className="div-radio">
              {selectedInvoice.pdfData ? (
                <button
                  onClick={() => handleViewPdf(selectedInvoice)}
                  className="gumb action-btn"
                >
                  <Icon icon="solar:eye-broken" /> Pregledaj PDF
                </button>
              ) : (
                <p>PDF nije dostupan</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showProgress && (
        <div className="popup">
          <div className="div div-clmn">
            <div className="popup-header">
              <h3>Status generiranja računa</h3>
              <button
                className="gumb action-btn zatvoriBtn"
                onClick={() => {
                  setShowProgress(false);
                  setProgressMessage('');
                }}
              >
                <Icon icon="solar:close-circle-broken" />
              </button>
            </div>
            <div className="progress-container">
              <div
                className="progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="progress-message">{progressMessage}</p>
            {generating && (
              <div className="loading-spinner">
                <Icon icon="solar:refresh-circle-broken" className="spin" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="main">
        <div className="karticaZadatka" style={{ overflow: 'visible' }}>
          <div className="div-row">
            <span style={{color: 'rgb(var(--isticanje))'}}>Ukupno računa: {totalInvoices || 0}</span>
            <div className="p">
              Upravljanje računima i članarinama za učenike. Računi se generiraju automatski ili se učitavaju iz PDF dokumenata. Svaki račun je povezan s učenikom putem OIB-a.
            </div>
          </div>

          {/* Desktop actions - all visible */}
          <div className="desktop-actions" style={{
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            marginTop: '1rem',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <button
              className="action-btn spremiBtn"
              onClick={handleAddInvoiceClick}
              disabled={generating}
            >
              <Icon icon="solar:document-broken" />
              {generating ? 'Generiranje...' : 'Generiraj članarine'}
            </button>
            <button
              className="gumb action-btn abEdit"
              onClick={handleGenerateClick}
              disabled={generating}
            >
              <Icon icon="solar:upload-broken" />
              {generating ? 'Učitavanje...' : 'Učitaj PDF račune'}
            </button>
            <button
              className="gumb action-btn abExpand"
              onClick={() => setShowStatusUpload(true)}
              disabled={generating}
            >
              <Icon icon="solar:file-check-broken" />
              Ažuriraj statuse
            </button>
          </div>

          {/* Mobile actions - primary button + overflow menu */}
          <div className="mobile-actions" style={{
            fontSize: '0.7rem',
            display: 'none',
            alignItems: 'center',
            marginTop: '1rem',
            gap: '0.5rem',
            position: 'relative'
          }}>
            <button
              className="action-btn spremiBtn"
              onClick={handleAddInvoiceClick}
              disabled={generating}
              style={{ flex: 1 }}
            >
              <Icon icon="solar:document-broken" fontSize="large" />
              {generating ? 'Generiranje...' : 'Generiraj članarine'}
            </button>
            <button
              className="action-btn abExpand"
              onClick={() => setShowMobileActionsMenu(!showMobileActionsMenu)}
              style={{ padding: '0.5rem 0.75rem' }}
              title="Više akcija"
            >
              <Icon icon="solar:menu-dots-bold" fontSize="large" />
            </button>

            {/* Mobile actions dropdown */}
            {showMobileActionsMenu && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 998
                  }}
                  onClick={() => setShowMobileActionsMenu(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'var(--iznad)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 999,
                  minWidth: '220px',
                  overflow: 'hidden'
                }}>
                  <button
                    className="action-btn"
                    onClick={() => {
                      handleGenerateClick();
                      setShowMobileActionsMenu(false);
                    }}
                    disabled={generating}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      borderRadius: 0,
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      background: 'transparent',
                      padding: '0.75rem 1rem'
                    }}
                  >
                    <Icon icon="solar:upload-broken" /> Učitaj PDF račune
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => {
                      setShowStatusUpload(true);
                      setShowMobileActionsMenu(false);
                    }}
                    disabled={generating}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      borderRadius: 0,
                      border: 'none',
                      background: 'transparent',
                      padding: '0.75rem 1rem'
                    }}
                  >
                    <Icon icon="solar:file-check-broken" /> Ažuriraj statuse
                  </button>
                </div>
              </>
            )}
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            @media (max-width: 768px) {
              .desktop-actions {
                display: none !important;
              }
              .mobile-actions {
                display: flex !important;
              }
            }
          `}} />
        </div>

        {showConfirmGenerate && (
          <div className="popup">
            <div className="div div-clmn">
              <h3>Učitavanje članarina</h3>
              <p>Odaberite PDF datoteku s članarinama za učitavanje.</p>
              <div className="p">
                Ova akcija će:
                <ul>
                  <li>Razdvojiti PDF na pojedinačne stranice</li>
                  <li>Pronaći OIB na svakoj stranici i povezati s učenikom</li>
                  <li>Spremiti članarine i poslati obavijesti učenicima</li>
                </ul>
              </div>
              <div className="file-upload-section">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                    }
                  }}
                  className="file-input"
                  id="invoice-file-input"
                  disabled={generating}
                />
                <label htmlFor="invoice-file-input" className={`action-btn spremiBtn ${generating ? 'disabled' : ''}`}>
                  <Icon icon={generating ? "solar:loading-bold-duotone" : "solar:upload-broken"}
                        className={generating ? "spin" : ""} />
                  {generating ? 'Učitavanje...' : 'Odaberi PDF datoteku'}
                </label>
                {selectedFile && (
                  <div className="selected-file">
                    <p>Odabrana datoteka: {selectedFile.name}</p>
                    <button
                      className="gumb action-btn spremiBtn"
                      onClick={handleBulkPdfUpload}
                      disabled={generating}
                    >
                      <Icon icon="solar:upload-broken" />
                      {generating ? 'Učitavanje...' : 'Učitaj račune'}
                    </button>
                  </div>
                )}
              </div>
              <div className="div-radio">
                <button
                  className="gumb action-btn zatvoriBtn"
                  onClick={() => {
                    if (!generating) {
                      setShowConfirmGenerate(false);
                      setShowProgress(false);
                      setProgress(0);
                      setProgressMessage('');
                      setSelectedFile(null);
                    }
                  }}
                  disabled={generating}
                >
                  <Icon icon="solar:close-circle-broken" /> Odustani
                </button>
              </div>
            </div>
          </div>
        )}

        {showStatusUpload && (
          <div className="popup">
            <div className="div div-clmn">
              <h3>Ažuriranje statusa računa</h3>
              <p>Odaberite XLSX datoteku sa statusima računa.</p>
              <div className="p">
                <h4>Podržani formati:</h4>

                <div className="format-section">
                  <h5>1. Jednostavni format (samo status)</h5>
                  <ul>
                    <li>Prvi stupac (opcionalno): Ime učenika</li>
                    <li>Drugi stupac (opcionalno): Prezime učenika</li>
                    <li>Treći stupac: OIB učenika (11 znamenki)</li>
                    <li>Zadnji stupac: Status ("da" za plaćeno, "ne" za neplaćeno)</li>
                  </ul>
                  <div className="tablica">
                    <div className="tr naziv">
                      <div className="th">Ime</div>
                      <div className="th">Prezime</div>
                      <div className="th">OIB</div>
                      <div className="th">Status</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Ivan</div>
                      <div className="th">Horvat</div>
                      <div className="th">12345678901</div>
                      <div className="th">da</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Ana</div>
                      <div className="th">Kovač</div>
                      <div className="th">98765432109</div>
                      <div className="th">ne</div>
                    </div>
                  </div>
                  <br />
                  <p>Ili samo s OIB-om:</p>
                  <div className="tablica">
                    <div className="tr naziv">
                      <div className="th">OIB</div>
                      <div className="th">Status</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">12345678901</div>
                      <div className="th">da</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">98765432109</div>
                      <div className="th">ne</div>
                    </div>
                  </div>
                  <p className="note">
                    Ovaj format samo mijenja oznaku neplaćenih računa za učenika. Stupci Ime i Prezime su opcionalni i služe samo za lakšu provjeru.
                  </p>
                </div>

                <div className="format-section">
                  <h5>2. Format po mjesecima</h5>
                  <ul>
                    <li>Prvi stupac (opcionalno): Ime učenika</li>
                    <li>Drugi stupac (opcionalno): Prezime učenika</li>
                    <li>Treći stupac: OIB učenika (11 znamenki)</li>
                    <li>Ostali stupci: Mjeseci (rujan, listopad, studeni, ...)</li>
                    <li>Vrijednosti: "da" za plaćeno, "ne" za neplaćeno</li>
                  </ul>
                  <div className="tablica">
                    <div className="tr naziv">
                      <div className="th">Ime</div>
                      <div className="th">Prezime</div>
                      <div className="th">OIB</div>
                      <div className="th">rujan</div>
                      <div className="th">listopad</div>
                      <div className="th">studeni</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Ivan</div>
                      <div className="th">Horvat</div>
                      <div className="th">12345678901</div>
                      <div className="th">da</div>
                      <div className="th">da</div>
                      <div className="th">ne</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Ana</div>
                      <div className="th">Kovač</div>
                      <div className="th">98765432109</div>
                      <div className="th">ne</div>
                      <div className="th">da</div>
                      <div className="th">da</div>
                    </div>
                  </div>
                  <br />
                  <p>Ili samo s OIB-om:</p>
                  <div className="tablica">
                    <div className="tr naziv">
                      <div className="th">OIB</div>
                      <div className="th">rujan</div>
                      <div className="th">listopad</div>
                      <div className="th">studeni</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">12345678901</div>
                      <div className="th">da</div>
                      <div className="th">da</div>
                      <div className="th">ne</div>
                    </div>
                  </div>
                  <p className="note">
                    Ovaj format ažurira status svakog računa po mjesecu i označava učenika ako ima neplaćene račune. Stupci Ime i Prezime su opcionalni i služe samo za lakšu provjeru.
                  </p>
                </div>
              </div>
              <div className="file-upload-section">
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedStatusFile(file);
                    }
                  }}
                  className="file-input"
                  id="status-file-input"
                  disabled={generating}
                />
                <label htmlFor="status-file-input" className={`action-btn spremiBtn${generating ? 'disabled' : ''}`}>
                  <Icon icon={generating ? "solar:loading-bold-duotone" : "solar:upload-broken"}
                        className={generating ? "spin" : ""} />
                  {generating ? 'Učitavanje...' : 'Odaberi XLSX datoteku'}
                </label>
                {selectedStatusFile && (
                  <div className="selected-file">
                    <p>Odabrana datoteka: {selectedStatusFile.name}</p>
                    <button
                      className="gumb action-btn spremiBtn"
                      onClick={handleStatusUpload}
                      disabled={generating}
                    >
                      <Icon icon="solar:upload-broken" />
                      {generating ? 'Učitavanje...' : 'Ažuriraj statuse'}
                    </button>
                  </div>
                )}
              </div>
              <div className="div-radio">
                <button
                  className="gumb action-btn zatvoriBtn"
                  onClick={() => {
                    if (!generating) {
                      setShowStatusUpload(false);
                      setSelectedStatusFile(null);
                    }
                  }}
                  disabled={generating}
                >
                  <Icon icon="solar:close-circle-broken" /> Odustani
                </button>
              </div>
            </div>
          </div>
        )}

          {/* Invoice Settings Table */}
          <div className="karticaZadatka" style={{ alignItems: 'stretch' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Postavke računa</h3>
            {invoiceSettings && Object.keys(invoiceSettings).length > 0 ? (
              <div className="tablica">
                <div className="tr redak">
                  <div style={{ gridColumn: '1 / -1', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          {invoiceSettings.nazivObrta}
                        </div>
                        <div className="txt-min2" style={{ opacity: 0.8, marginTop: '0.25rem' }}>
                          {invoiceSettings.active ? (
                            <span style={{ color: 'rgb(var(--isticanje))' }}>✓ Aktivno</span>
                          ) : (
                            <span style={{ color: 'rgb(var(--error))' }}>✗ Neaktivno</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="action-btn abEdit"
                        onClick={() => setShowInvoiceSettings(true)}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        <Icon icon="solar:pen-bold" /> Uredi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p>Nema postavljenih postavki računa za vašu školu!</p>
            )}
          </div>

          {/* Invoices Table */}
          <div className="karticaZadatka" style={{ alignItems: 'stretch' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Računi i članarine</h3>

            {/* Filters */}
            <div className="racuni-filters" style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              <select
                id="school-filter"
                className="input-login-signup"
                value={selectedSchool}
                onChange={handleSchoolFilterChange}
                style={{ flex: 1, minWidth: '150px' }}
              >
                <option value="">Sve škole</option>
                {schools && schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <select
                id="program-filter"
                className="input-login-signup"
                value={selectedProgram}
                onChange={handleProgramFilterChange}
                style={{ flex: 1, minWidth: '150px' }}
              >
                <option value="">Svi programi</option>
                {programs && programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.naziv}
                  </option>
                ))}
              </select>
              <select
                id="month-filter"
                className="input-login-signup"
                value={selectedMonth}
                onChange={handleMonthFilterChange}
                style={{ flex: 1, minWidth: '150px' }}
              >
                <option value="">Svi mjeseci</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            {isLoadingInvoices ? (
              <div className="loading-spinner" style={{ textAlign: 'center', padding: '2rem' }}>
                <Icon icon="solar:refresh-circle-broken" className="spin" />
              </div>
            ) : filteredRacuni.length > 0 ? (
              <>
                <div className="tablica">
                  {filteredRacuni.map((racun) => (
                    <div className="tr redak" key={racun.id}>
                      <div style={{ gridColumn: '1 / -1', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '200px' }}>
                            <div style={{ fontWeight: 600 }}>
                              {racun.student ? `${racun.student.ime} ${racun.student.prezime}` : 'N/A'}
                            </div>
                            <div className="txt-min2" style={{ opacity: 0.8 }}>
                              {new Date(racun.year, racun.month - 1).toLocaleDateString('hr-HR', {
                                year: 'numeric',
                                month: 'long'
                              })}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              className="action-btn abEdit"
                              onClick={() => setSelectedInvoice(racun)}
                              title="Pregledaj račun"
                            >
                              <Icon icon="solar:eye-broken" />
                            </button>
                            <button
                              className="action-btn abDelete"
                              onClick={() => setDeleteConfirmation(racun)}
                              title="Obriši račun"
                            >
                              <Icon icon="solar:trash-bin-trash-broken" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="pagination-controls" style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '1rem',
                  padding: '1rem 0'
                }}>
                  <button
                    className="action-btn"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{ padding: '0.5rem 0.75rem' }}
                  >
                    <Icon icon="solar:arrow-left-broken" />
                  </button>
                  <span className="pagination-info" style={{ fontSize: '0.9rem' }}>
                    Stranica {currentPage} od {totalPages}
                  </span>
                  <button
                    className="action-btn"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{ padding: '0.5rem 0.75rem' }}
                  >
                    <Icon icon="solar:arrow-right-broken" />
                  </button>
                </div>
              </>
            ) : (
              <p>Nema dostupnih računa.</p>
            )}
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            @media (max-width: 768px) {
              .racuni-filters {
                flex-direction: column !important;
              }
              .racuni-filters select {
                width: 100% !important;
              }
            }
          `}} />


        {deleteConfirmation && (
          <div className="popup">
            <div className="div div-clmn">
              <h3>Potvrda brisanja</h3>
              <p>Jeste li sigurni da želite obrisati ovaj račun?</p>
              <div className="div-radio">
                <button
                  className="gumb action-btn zatvoriBtn"
                  onClick={() => setDeleteConfirmation(null)}
                >
                  <Icon icon="solar:close-circle-broken" /> Odustani
                </button>
                <button
                  className="gumb action-btn abDelete"
                  onClick={() => handleDeleteInvoice(deleteConfirmation.id)}
                >
                  <Icon icon="solar:trash-bin-trash-broken" /> Obriši
                </button>
              </div>
            </div>
          </div>
        )}

        {notification && (
          <Notifikacija
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
            autoClose={3000}
          />
        )}

        {showBulkGenerate && (
          <div className="popup">
            <div className="div div-clmn">
              <h3>Generiranje računa/članarine</h3>
              <div className="form-group">
                <label htmlFor="type-select">Tip dokumenta:</label>
                <select
                  id="type-select"
                  className="input-login-signup"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="">Odaberite tip</option>
                  <option value="račun">Račun</option>
                  <option value="članarina">Članarina</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="generation-mode">Način generiranja:</label>
                <select
                  id="generation-mode"
                  className="input-login-signup"
                  value={generationMode}
                  onChange={(e) => setGenerationMode(e.target.value)}
                >
                  <option value="all">Svi učenici</option>
                  <option value="selected">Odabrani učenici</option>
                </select>
              </div>

              {generationMode === 'selected' && (
                <div className="div div-clmn">
                  <label>Pretraži i dodaj učenike:</label>
                  <input
                    className="input-login-signup"
                    type="text"
                    value={studentInput}
                    onChange={handleSearch}
                    placeholder="Pretraži učenike..."
                  />

                  {/* Search results */}
                  {searchResults.length > 0 && studentInput.length >= 2 && (
                    <div className="tablica">
                      <div className="tr naziv">
                        <div className="th">Rezultati pretrage</div>
                        <div className="th"></div>
                      </div>
                      {searchResults.map((student) => (
                        <div key={student.id} className="tr redak">
                          <div className="th">{student.ime} {student.prezime}</div>
                          <div className="th">
                            {!student.isSelected ? (
                              <button
                                className="action-btn abEdit"
                                onClick={() => handleAddStudent(student)}
                                type="button"
                              >
                                Dodaj
                              </button>
                            ) : (
                              <button
                                className="action-btn abDelete"
                                onClick={() => handleRemoveStudent(student.id)}
                                type="button"
                              >
                                Ukloni
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected students */}
                  <div className="tablica">
                    <div className="tr naziv">
                      <div className="th">Odabrani učenici</div>
                      <div className="th"></div>
                    </div>
                    {selectedStudents.length > 0 ? (
                      selectedStudents.map((student) => (
                        <div key={student.id} className="tr redak">
                          <div className="th">{student.ime} {student.prezime}</div>
                          <div className="th">
                            <button
                              className="action-btn abDelete"
                              onClick={() => handleRemoveStudent(student.id)}
                              type="button"
                            >
                              Ukloni
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="tr redak">
                        <div className="th" colSpan="2">
                          Nema odabranih učenika
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="div-radio">
                <button
                  className="gumb action-btn zatvoriBtn"
                  onClick={() => {
                    if (!generating) {
                      setShowBulkGenerate(false);
                      setSelectedType('');
                      setSelectedStudents([]);
                      setGenerationMode('all');
                    }
                  }}
                  disabled={generating}
                >
                  <Icon icon="solar:close-circle-broken" /> Odustani
                </button>
                <button
                  className="gumb action-btn spremiBtn"
                  onClick={handleBulkGenerate}
                  disabled={generating || !selectedType || (generationMode === 'selected' && selectedStudents.length === 0)}
                >
                  <Icon icon="solar:file-add-broken" />
                  {generating ? 'Generiranje...' : `Generiraj ${selectedType === 'članarina' ? 'članarine' : 'račune'}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default RacuniAdmin;
