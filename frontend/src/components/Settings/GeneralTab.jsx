import React from 'react';

export default function GeneralTab({
  settingsData,
  pendingUpdates,
  setPendingUpdates,
  setSettingsData,
  showToast
}) {
  const toggleVisibility = (key) => {
    const input = document.getElementById(`key-${key}`);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  };

  const selectProvider = (provider) => {
    setPendingUpdates(prev => ({ ...prev, ACTIVE_IMAGE_PROVIDER: provider }));
    setSettingsData(prev => ({ ...prev, activeProvider: provider }));
  };

  const keysMap = {};
  if (settingsData && settingsData.keys) {
    settingsData.keys.forEach(k => { keysMap[k.key] = k; });
  }

  const openaiSet = !!(keysMap['OPENAI_API_KEY'] && keysMap['OPENAI_API_KEY'].set);
  const falSet = !!(keysMap['FAL_KEY'] && keysMap['FAL_KEY'].set);
  const geminiSet = !!(keysMap['GEMINI_API_KEY'] && keysMap['GEMINI_API_KEY'].set);

  const provider = settingsData?.activeProvider || 'gpt-image-2';

  const groups = {};
  if (settingsData?.keys) {
    settingsData.keys.forEach(k => {
      if (!groups[k.group]) groups[k.group] = [];
      groups[k.group].push(k);
    });
  }

  return (
    <div className="section">
      <div className="settings-group">
        <div className="settings-group-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Provedor de Geração de Imagens
        </div>
        <div className="settings-group-sub">Escolha qual API será usada para gerar as imagens dos slides</div>
        <div className="provider-selector">
          <div
            className={`provider-card ${provider === 'gpt-image-2' ? 'active' : ''} ${!openaiSet ? 'disabled-card' : ''}`}
            onClick={() => openaiSet && selectProvider('gpt-image-2')}
            style={{ opacity: openaiSet ? 1 : 0.4, cursor: openaiSet ? 'pointer' : 'not-allowed', pointerEvents: openaiSet ? 'auto' : 'none' }}
          >
            <div className="provider-icon">🤖</div>
            <div className="provider-name">GPT Image 2</div>
            <div className="provider-desc">OpenAI · DALL-E 3 · ~$0.08/img</div>
          </div>
          <div
            className={`provider-card ${provider === 'gpt-image-1-mini' ? 'active' : ''} ${!openaiSet ? 'disabled-card' : ''}`}
            onClick={() => openaiSet && selectProvider('gpt-image-1-mini')}
            style={{ opacity: openaiSet ? 1 : 0.4, cursor: openaiSet ? 'pointer' : 'not-allowed', pointerEvents: openaiSet ? 'auto' : 'none' }}
          >
            <div className="provider-icon">🖼️</div>
            <div className="provider-name">GPT Image 1 Mini</div>
            <div className="provider-desc">OpenAI · Econômico · ~$0.02/img</div>
          </div>
          <div
            className={`provider-card ${provider === 'fal' ? 'active' : ''} ${!falSet ? 'disabled-card' : ''}`}
            onClick={() => falSet && selectProvider('fal')}
            style={{ opacity: falSet ? 1 : 0.4, cursor: falSet ? 'pointer' : 'not-allowed', pointerEvents: falSet ? 'auto' : 'none' }}
          >
            <div className="provider-icon">⚡</div>
            <div className="provider-name">Fal.ai</div>
            <div className="provider-desc">Flux / SDXL · Rápido · ~$0.003/img</div>
          </div>
          <div
            className={`provider-card ${provider === 'gemini' ? 'active' : ''} ${!geminiSet ? 'disabled-card' : ''}`}
            onClick={() => geminiSet && selectProvider('gemini')}
            style={{ opacity: geminiSet ? 1 : 0.4, cursor: geminiSet ? 'pointer' : 'not-allowed', pointerEvents: geminiSet ? 'auto' : 'none' }}
          >
            <div className="provider-icon">✦</div>
            <div className="provider-name">Gemini Imagen</div>
            <div className="provider-desc">Google · Experimental · Pré-pago</div>
          </div>
        </div>
      </div>

      <div className="settings-group" style={{ marginTop: '24px' }}>
        <div className="settings-group-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Modelo de Escrita da Copy
        </div>
        <div className="settings-group-sub">Escolha qual modelo de inteligência artificial será usado para escrever a copy dos carrosséis</div>
        <div style={{ marginTop: '12px' }}>
          <select
            className="key-input"
            value={settingsData?.activeCopyModel || 'gpt-4o'}
            onChange={(e) => {
              const val = e.target.value;
              setPendingUpdates(prev => ({ ...prev, COPY_GENERATION_MODEL: val }));
              setSettingsData(prev => ({ ...prev, activeCopyModel: val }));
            }}
            style={{ width: '100%', maxWidth: '400px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="gpt-4o">GPT-4o (Recomendado - Completo e Criativo)</option>
            <option value="gpt-4o-mini">GPT-4o-mini (Rápido e Econômico)</option>
            <option value="o1-mini">o1-mini (Raciocínio Lógico Avançado)</option>
            <option value="o1-preview">o1-preview (Complexo)</option>
            <option value="gpt-5">GPT-5 (Completo - Próxima Geração)</option>
            <option value="gpt-5-mini">GPT-5-mini (Veloz e Inteligente)</option>
            <option value="gpt-5.4">GPT-5.4 (Legado/Personalizado)</option>
          </select>
        </div>
      </div>

      {Object.entries(groups).map(([groupName, keys]) => (
        <div className="key-group" key={groupName}>
          <div className="key-group-title">{groupName}</div>
          {keys.filter(k => k.key !== 'ACTIVE_IMAGE_PROVIDER' && k.key !== 'COPY_GENERATION_MODEL').map(k => (
            <div className="key-row" key={k.key}>
              <div className="key-label">
                <span className={`key-status ${k.set ? 'set' : ''}`}></span>
                {k.label}
              </div>
              <input
                className="key-input"
                id={`key-${k.key}`}
                type="password"
                defaultValue={k.value || ''}
                placeholder={k.masked || 'Não configurada'}
                autoComplete="off"
                onChange={(e) => setPendingUpdates(prev => ({ ...prev, [k.key]: e.target.value }))}
              />
              <button className="key-reveal" onClick={() => toggleVisibility(k.key)}>Mostrar</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
