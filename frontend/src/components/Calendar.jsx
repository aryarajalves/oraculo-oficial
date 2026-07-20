import React, { useState, useEffect } from 'react';

export default function Calendar({ allCarousels, onLoadCarousels, showToast, imageVersion }) {
  const [currentCalDate, setCurrentCalDate] = useState(new Date());
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedCarouselId, setSelectedCarouselId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [saving, setSaving] = useState(false);

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const openScheduleModal = (carouselId = null, dateStr = null) => {
    setSelectedCarouselId(carouselId || '');
    setScheduleDate(dateStr || new Date().toISOString().split('T')[0]);
    if (carouselId) {
      const c = allCarousels.find(x => x.id === carouselId);
      if (c) {
        setScheduleDate(c.scheduledDate || new Date().toISOString().split('T')[0]);
        setScheduleTime((c.scheduledTime || '09h00').replace('h', ':'));
      }
    } else {
      setScheduleTime('09:00');
    }
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedCarouselId || !scheduleDate || !scheduleTime) {
      alert("Preencha todos os campos!");
      return;
    }
    setSaving(true);
    const time = scheduleTime.replace(':', 'h');
    try {
      const res = await fetch(`/api/carousels/${selectedCarouselId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: scheduleDate, scheduledTime: time, status: 'aprovado' })
      });
      if (res.ok) {
        showToast('Carrossel agendado com sucesso!');
        setScheduleModalOpen(false);
        onLoadCarousels();
      }
    } catch (e) {
      alert('Erro ao agendar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Days slots
  const days = [];
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(<div className="cal-day empty" key={`empty-${i}`}></div>);
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const scheduled = allCarousels.filter(c => c.scheduledDate === dayStr);
    const isToday = new Date().toISOString().split('T')[0] === dayStr;

    days.push(
      <div className={`cal-day ${isToday ? 'today' : ''}`} key={i}>
        <div className="cal-day-num">{i}</div>
        <div className="cal-events">
          {scheduled.map(c => (
            <div className="cal-event" key={c.id} onClick={() => openScheduleModal(c.id)}>
              <span className="cal-event-time">{c.scheduledTime || '00h00'}</span>
              <span className="cal-event-title" title={c.title}>{c.title}</span>
            </div>
          ))}
        </div>
        <button className="cal-add-btn" onClick={() => openScheduleModal(null, dayStr)}>+ agendar</button>
      </div>
    );
  }

  const pendings = allCarousels.filter(c => c.status !== 'publicado');

  return (
    <div>
      <div className="oraculo-header">
        <div>
          <div className="oraculo-title">CALENDÁRIO DE PUBLICAÇÃO</div>
          <div className="oraculo-subtitle">Organize os carrosséis aprovados nos horários de publicação (09h, 13h, 20h)</div>
        </div>
      </div>

      <div className="section">
        <div className="cal-wrap">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => setCurrentCalDate(new Date(year, month - 1, 1))}>‹ Anterior</button>
            <div className="cal-month">{`${monthNames[month]} ${year}`}</div>
            <button className="cal-nav-btn" onClick={() => setCurrentCalDate(new Date(year, month + 1, 1))}>Próximo ›</button>
          </div>
          <div className="cal-weekdays">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(w => <div className="cal-weekday" key={w}>{w}</div>)}
          </div>
          <div className="cal-grid">
            {days}
          </div>
        </div>
      </div>

      {scheduleModalOpen && (
        <div className="form-modal open">
          <div className="form-box" style={{ maxWidth: '550px' }}>
            <div className="form-title">Agendar Carrossel</div>
            <div className="form-group">
              <label className="form-label">Carrossel Disponível (Clique para selecionar)</label>
              <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendings.length === 0 ? (
                  <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>Nenhum carrossel pendente</div>
                ) : (
                  pendings.map(c => (
                    <div
                      key={c.id}
                      className="sch-item"
                      onClick={() => setSelectedCarouselId(c.id)}
                      style={{
                        display: 'flex', gap: '10px', padding: '8px',
                        border: '1px solid',
                        borderColor: selectedCarouselId === c.id ? 'var(--gold)' : 'var(--border)',
                        background: selectedCarouselId === c.id ? 'rgba(201,168,76,0.1)' : 'var(--surface2)',
                        borderRadius: '6px', cursor: 'pointer', alignItems: 'center'
                      }}
                    >
                      {c.slides && c.slides.length > 0 ? (
                        <img src={`/api/carousels/${c.id}/image/${c.slides[0]}?v=${imageVersion}`} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} alt="" />
                      ) : (
                        <div style={{ width: '40px', height: '40px', background: 'var(--border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>Sem Img</div>
                      )}
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text)', lineHeight: 1.2, marginBottom: '4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{c.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{c.status.toUpperCase()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Data</label>
                <input type="date" className="form-input" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Horário</label>
                <input type="time" className="form-input" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: '10px' }}>
              <button className="btn btn-outline" onClick={() => setScheduleModalOpen(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={handleSaveSchedule} disabled={saving}>
                {saving ? 'Agendando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
