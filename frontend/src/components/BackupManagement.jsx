import React, { useState, useEffect, useRef } from 'react';
import BackupStatusCards from './BackupStatusCards';
import BackupConfigForm from './BackupConfigForm';
import BackupList from './BackupList';
import BackupModals from './BackupModals';

export default function BackupManagement({ showToast }) {
  const [config, setConfig] = useState({
    enabled: false,
    frequency: 'hours',
    interval_val: 6,
    s3_folder: 'backups/',
    retention: 30
  });

  const [backups, setBackups] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Seleção e Exclusão em Massa
  const [selectedBackups, setSelectedBackups] = useState([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  // Paginação e Exibição
  const [displayCount, setDisplayCount] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Modais de Confirmação
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreFilename, setRestoreFilename] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteFilename, setDeleteFilename] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadConfig();
    loadBackups();
  }, []);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/backups/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      showToast('Erro ao carregar configurações de backup.');
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadBackups = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/backups/list');
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      }
    } catch (e) {
      showToast('Erro ao carregar lista de backups.');
    } finally {
      setLoadingList(false);
    }
  };

  const handleSaveConfig = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/backups/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        showToast('✓ Configuração de backup salva com sucesso!');
        loadConfig();
      } else {
        showToast('Erro ao salvar configuração.');
      }
    } catch (e) {
      showToast('Erro de rede ao salvar configuração.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualBackup = async () => {
    setActionLoading(true);
    showToast('⚙️ Iniciando backup imediato...');
    try {
      const res = await fetch('/api/backups/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`✓ Backup ${data.filename} gerado com sucesso!`);
        loadBackups();
      } else {
        const data = await res.json();
        showToast(data.error || 'Erro ao gerar backup.');
      }
    } catch (e) {
      showToast('Erro de rede ao gerar backup.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading(true);
    showToast('📤 Enviando arquivo de backup para o S3...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/backups/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`✓ Backup ${data.filename} importado com sucesso!`);
        loadBackups();
      } else {
        const data = await res.json();
        showToast(data.error || 'Falha no upload do backup.');
      }
    } catch (err) {
      showToast('Erro de rede ao importar backup.');
    } finally {
      setActionLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmRestore = (filename) => {
    setRestoreFilename(filename);
    setRestoreModalOpen(true);
  };

  const handleRestore = async () => {
    setRestoreModalOpen(false);
    setActionLoading(true);
    showToast(`⚙️ Restaurando banco de dados a partir de ${restoreFilename}...`);
    try {
      const res = await fetch(`/api/backups/restore/${restoreFilename}`, { method: 'POST' });
      if (res.ok) {
        showToast('✓ Banco de dados restaurado com sucesso!');
      } else {
        const data = await res.json();
        showToast(data.error || 'Falha ao restaurar banco de dados.');
      }
    } catch (e) {
      showToast('Erro de rede ao restaurar banco.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = (filename) => {
    setDeleteFilename(filename);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    setDeleteModalOpen(false);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/backups/${deleteFilename}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('✓ Backup excluído do S3.');
        loadBackups();
      } else {
        showToast('Falha ao deletar backup.');
      }
    } catch (e) {
      showToast('Erro de rede ao deletar backup.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectToggle = (filename) => {
    setSelectedBackups(prev => 
      prev.includes(filename) ? prev.filter(f => f !== filename) : [...prev, filename]
    );
  };

  const handleSelectAllToggle = () => {
    const currentPageFilenames = paginatedBackups.map(b => b.filename);
    const allSelectedOnPage = currentPageFilenames.every(f => selectedBackups.includes(f));

    if (allSelectedOnPage) {
      setSelectedBackups(prev => prev.filter(f => !currentPageFilenames.includes(f)));
    } else {
      setSelectedBackups(prev => {
        const union = new Set([...prev, ...currentPageFilenames]);
        return Array.from(union);
      });
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteModalOpen(false);
    setActionLoading(true);
    showToast(`⚙️ Excluindo ${selectedBackups.length} backup(s)...`);
    try {
      const res = await fetch('/api/backups/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: selectedBackups })
      });
      if (res.ok) {
        showToast('✓ Backups excluídos com sucesso do S3.');
        setSelectedBackups([]);
        loadBackups();
      } else {
        showToast('Falha ao excluir backups em massa.');
      }
    } catch (e) {
      showToast('Erro de rede ao excluir backups.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0.00 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getFreqLabel = (freq, count) => {
    const labels = {
      minutes: count === 1 ? 'minuto' : 'minutos',
      hours: count === 1 ? 'hora' : 'horas',
      days: count === 1 ? 'dia' : 'dias'
    };
    return labels[freq] || freq;
  };

  // Paginação
  const totalPages = Math.ceil(backups.length / displayCount) || 1;
  const paginatedBackups = backups.slice((currentPage - 1) * displayCount, currentPage * displayCount);

  // Informações de status dos Cards
  const successBackups = backups.filter(b => b.status === 'success');
  const lastSuccessBackup = successBackups[0];

  const lastBackupFilename = lastSuccessBackup ? lastSuccessBackup.filename : 'Nenhum backup realizado';
  const lastBackupTime = lastSuccessBackup ? new Date(lastSuccessBackup.created_at).toLocaleString('pt-BR') : '';

  let nextBackupTime = 'Agendamento desativado';
  let nextBackupSub = `A cada ${config.interval_val || 6} ${getFreqLabel(config.frequency, config.interval_val || 6)}`;

  if (config.enabled) {
    const lastTime = lastSuccessBackup ? new Date(lastSuccessBackup.created_at) : new Date(config.updated_at || Date.now());
    let intervalMs = 0;
    const value = config.interval_val || 6;
    if (config.frequency === 'minutes') {
      intervalMs = value * 60 * 1000;
    } else if (config.frequency === 'hours') {
      intervalMs = value * 60 * 60 * 1000;
    } else if (config.frequency === 'days') {
      intervalMs = value * 24 * 60 * 60 * 1000;
    }
    const nextDate = new Date(lastTime.getTime() + intervalMs);
    nextBackupTime = nextDate.toLocaleString('pt-BR');
    nextBackupSub = `A cada ${value} ${getFreqLabel(config.frequency, value)}(s)`;
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="oraculo-header">
        <div>
          <div className="oraculo-title">BACKUPS DO BANCO</div>
          <div className="oraculo-subtitle">Gerencie backups automáticos, faça downloads e restaure o banco de dados PostgreSQL.</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 16px' }}>
        
        {/* Cards de Status (Último, Próximo e Retenção) */}
        <BackupStatusCards
          lastBackupFilename={lastBackupFilename}
          lastBackupTime={lastBackupTime}
          nextBackupTime={nextBackupTime}
          nextBackupSub={nextBackupSub}
          retention={config.retention}
        />
        
        {/* Painel 1: Backup Manual */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.2 15a8.85 8.85 0 0 0-1.75-4.58c-.1-.13-.25-.23-.41-.3M12 13v8M9 16l3-3 3 3"/></svg>
              Backup Manual
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Clique para criar um backup imediato do banco de dados e enviar ao Backblaze S3.</div>
          </div>
          <button className="btn btn-gold" onClick={handleManualBackup} disabled={actionLoading}>
            <svg style={{ marginRight: '6px' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.2 15a8.85 8.85 0 0 0-1.75-4.58c-.1-.13-.25-.23-.41-.3M12 13v8M9 16l3-3 3 3"/></svg>
            Fazer Backup Agora
          </button>
        </div>

        {/* Painel 2: Importar Backup Externo */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Importar Backup Externo
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Envie um arquivo de backup (.dump ou .dump.gz) de outro servidor para salvá-lo no S3 e restaurar quando desejar.</div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept=".dump,.dump.gz" 
          />
          <button className="btn btn-outline" onClick={handleUploadClick} disabled={actionLoading} style={{ borderColor: 'var(--orange)', color: 'var(--orange)' }}>
            <svg style={{ marginRight: '6px' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Fazer Upload de Backup
          </button>
        </div>

        {/* Painel 3: Agendamento Automático */}
        <BackupConfigForm
          config={config}
          setConfig={setConfig}
          loadingConfig={loadingConfig}
          actionLoading={actionLoading}
          handleSaveConfig={handleSaveConfig}
          getFreqLabel={getFreqLabel}
        />

        {/* Painel 4: Lista de Backups */}
        <BackupList
          backups={backups}
          loadingList={loadingList}
          paginatedBackups={paginatedBackups}
          selectedBackups={selectedBackups}
          handleSelectAllToggle={handleSelectAllToggle}
          handleSelectToggle={handleSelectToggle}
          formatSize={formatSize}
          confirmRestore={confirmRestore}
          confirmDelete={confirmDelete}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          displayCount={displayCount}
          setDisplayCount={setDisplayCount}
          loadBackups={loadBackups}
          setBulkDeleteModalOpen={setBulkDeleteModalOpen}
        />

      </div>

      {/* Modais de Confirmação */}
      <BackupModals
        restoreModalOpen={restoreModalOpen}
        setRestoreModalOpen={setRestoreModalOpen}
        restoreFilename={restoreFilename}
        handleRestore={handleRestore}
        deleteModalOpen={deleteModalOpen}
        setDeleteModalOpen={setDeleteModalOpen}
        deleteFilename={deleteFilename}
        handleDelete={handleDelete}
        bulkDeleteModalOpen={bulkDeleteModalOpen}
        setBulkDeleteModalOpen={setBulkDeleteModalOpen}
        selectedBackups={selectedBackups}
        handleBulkDelete={handleBulkDelete}
        actionLoading={actionLoading}
      />
    </div>
  );
}
