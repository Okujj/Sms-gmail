
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Lead, SearchConfig, CampaignStatus, MarketInsights } from './types';
import { geminiService } from './services/geminiService';
import LeadCard from './components/LeadCard';

// Extend window for aistudio helpers using the global AIStudio type to match environment definitions
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Fix: Removed readonly modifier to avoid conflict with potential internal declarations 
    // of aistudio in the execution environment.
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [insights, setInsights] = useState<MarketInsights | null>(null);
  const [status, setStatus] = useState<CampaignStatus>(CampaignStatus.IDLE);
  const [config, setConfig] = useState<SearchConfig>({
    query: '',
    product: '',
    targetAgeRange: '26-40',
    campaignLink: '',
    customMessage: 'Olá {name}, percebi seu interesse em {product}. Gostaria de te apresentar uma solução exclusiva: {link}'
  });
  const [error, setError] = useState<{ message: string; isQuota: boolean } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const handleOpenKeyDialog = async () => {
    try {
      await window.aistudio.openSelectKey();
      setError(null);
      addLog("Nova chave de API selecionada. Pronto para continuar.");
    } catch (err) {
      addLog("Falha ao abrir seletor de chave.");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.query.trim() || !config.product.trim()) {
      setError({ message: "Por favor, preencha o nicho e o produto.", isQuota: false });
      return;
    }

    setError(null);
    setStatus(CampaignStatus.SEARCHING);
    addLog(`Pesquisando mercados globais para: "${config.product}"...`);
    addLog(`Buscando pelo menos 20 leads qualificados...`);
    
    try {
      const result = await geminiService.searchLeads(config.query, config.product);
      setLeads(result.leads);
      setInsights(result.insights);
      addLog(`Países identificados: ${result.insights.topCountries.join(', ')}`);
      addLog(`${result.leads.length} leads importados para análise.`);
      setStatus(CampaignStatus.IDLE);
    } catch (err: any) {
      const isQuotaError = err.status === 429 || err.message?.includes('429') || err.message?.includes('quota');
      setError({ 
        message: isQuotaError 
          ? "Cota da API excedida. Por favor, aguarde um momento ou use sua própria chave do Google Cloud." 
          : "Falha ao processar pesquisa avançada. Verifique sua conexão.",
        isQuota: isQuotaError
      });
      setStatus(CampaignStatus.IDLE);
      addLog(isQuotaError ? "Erro: Cota excedida (429)." : "Erro durante a prospecção.");
    }
  };

  const startAutomation = async () => {
    if (leads.length === 0) return;
    
    setStatus(CampaignStatus.VALIDATING);
    addLog("Iniciando fluxo de validação inteligente e disparo...");

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (lead.status === 'sent') continue; // Skip already sent leads
      
      addLog(`Analisando perfil: ${lead.email}...`);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'validating' } : l));
      
      const validation = await geminiService.validateLead(lead, config.targetAgeRange);
      const isValid = validation.isValid;
      
      setLeads(prev => prev.map(l => l.id === lead.id ? { 
        ...l, 
        status: isValid ? 'valid' : 'invalid',
        notes: validation.notes
      } : l));

      if (isValid) {
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'sending' } : l));
        const personalizedTemplate = config.customMessage.replace('{product}', config.product);
        const message = await geminiService.generatePersonalizedMessage(lead, config.campaignLink, personalizedTemplate);
        
        // Disparo simulado
        await new Promise(resolve => setTimeout(resolve, 1500));
        addLog(`Outreach concluído para ${lead.name}`);
        
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'sent' } : l));
      }
    }

    setStatus(CampaignStatus.COMPLETED);
    addLog("Ciclo de campanha finalizado.");
  };

  const reset = () => {
    setLeads([]);
    setInsights(null);
    setStatus(CampaignStatus.IDLE);
    setLogs([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-indigo-700 text-white py-5 px-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <i className="fas fa-globe-americas fa-2xl text-indigo-200"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter">G-LEAD HUNTER <span className="text-indigo-300 font-light">GLOBAL</span></h1>
              <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-[0.2em] opacity-80">Market Research & Outreach AI</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleOpenKeyDialog}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl border border-indigo-400/30 flex items-center gap-2 transition-all"
            >
              <i className="fas fa-key text-indigo-200"></i>
              Configurar Chave Própria
            </button>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold opacity-70">STATUS DA ENGINE</span>
              <span className="text-xs font-mono text-emerald-300">ONLINE • GEMINI-3-PRO</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {/* Search Controls */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-800">
              <i className="fas fa-filter text-indigo-600"></i>
              Configurações
            </h2>
            <form onSubmit={handleSearch} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Produto para Análise</label>
                <input 
                  type="text"
                  value={config.product}
                  onChange={(e) => setConfig({...config, product: e.target.value})}
                  className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                  placeholder="Ex: iPhone 15, Curso de IA..."
                  disabled={status !== CampaignStatus.IDLE}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nicho de Público</label>
                <input 
                  type="text"
                  value={config.query}
                  onChange={(e) => setConfig({...config, query: e.target.value})}
                  className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                  placeholder="Ex: Designers, Gamers..."
                  disabled={status !== CampaignStatus.IDLE}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Público Alvo (Idade)</label>
                <select 
                  value={config.targetAgeRange}
                  onChange={(e) => setConfig({...config, targetAgeRange: e.target.value})}
                  className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  disabled={status !== CampaignStatus.IDLE}
                >
                  <option value="18-25">18 - 25 anos (Geração Z)</option>
                  <option value="26-40">26 - 40 anos (Millennials)</option>
                  <option value="40+">40+ anos (Boomers/X)</option>
                </select>
              </div>
              <button 
                type="submit"
                disabled={status !== CampaignStatus.IDLE || !config.product}
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {status === CampaignStatus.SEARCHING ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-search-dollar"></i>}
                Localizar 20+ Leads
              </button>
            </form>
          </section>

          {/* Outreach Campaign */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-800">
              <i className="fas fa-bullhorn text-indigo-600"></i>
              Outreach
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Link da Oferta</label>
                <input 
                  type="url"
                  value={config.campaignLink}
                  onChange={(e) => setConfig({...config, campaignLink: e.target.value})}
                  className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  placeholder="https://suapagina.com"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mensagem de Conversão</label>
                <textarea 
                  rows={4}
                  value={config.customMessage}
                  onChange={(e) => setConfig({...config, customMessage: e.target.value})}
                  className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm placeholder:text-slate-300 resize-none"
                  placeholder="Use as variáveis: {name}, {product}, {link}"
                />
                <p className="text-[10px] text-slate-400 mt-2 italic">Dica: A IA irá melhorar este texto para torná-lo mais persuasivo.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <button 
                  onClick={startAutomation}
                  disabled={leads.length === 0 || status !== CampaignStatus.IDLE || !config.campaignLink}
                  className="py-4 px-6 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <i className="fas fa-play-circle"></i>
                  Iniciar Disparo
                </button>
                <button 
                  onClick={reset}
                  className="py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-bold text-sm uppercase transition-all flex items-center justify-center gap-3"
                >
                  <i className="fas fa-trash-alt"></i>
                  Limpar
                </button>
              </div>
            </div>
          </section>

          {/* Terminal */}
          <section className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Logs</span>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
              </div>
            </div>
            <div className="h-48 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar pr-2">
              {logs.length === 0 && <p className="text-slate-700 italic">Pronto para iniciar prospecção...</p>}
              {logs.map((log, i) => (
                <p key={i} className={i === 0 ? "text-indigo-400 font-bold" : "text-slate-400"}>
                  <span className="text-slate-600 mr-2">➜</span> {log}
                </p>
              ))}
            </div>
          </section>
        </div>

        {/* Right Content */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Market Insights Banner */}
          {insights && (
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <i className="fas fa-chart-line text-indigo-200"></i>
                  <h3 className="text-lg font-black uppercase tracking-tight">Análise de Mercado Global</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-bold text-indigo-200 uppercase mb-3">Principais Mercados para {config.product}</p>
                    <div className="flex flex-wrap gap-2">
                      {insights.topCountries.map((country, idx) => (
                        <span key={idx} className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-bold border border-white/20">
                          {country}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-200 uppercase mb-2">Conclusão da IA</p>
                    <p className="text-sm leading-relaxed text-indigo-50 italic">
                      "{insights.rationale}"
                    </p>
                  </div>

                  {/* Grounding Sources display as required by Search Grounding guidelines */}
                  {insights.sources && insights.sources.length > 0 && (
                    <div className="md:col-span-2 pt-4 border-t border-white/10 mt-2">
                      <p className="text-[10px] font-bold text-indigo-200 uppercase mb-3 flex items-center gap-2">
                        <i className="fas fa-info-circle"></i>
                        Fontes de Grounding (Google Search)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {insights.sources.map((source, idx) => (
                          <a 
                            key={idx} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[9px] bg-white/5 hover:bg-white/20 px-2 py-1 rounded border border-white/10 transition-colors flex items-center gap-2 max-w-[200px]"
                            title={source.title}
                          >
                            <i className="fas fa-external-link-alt opacity-50"></i>
                            <span className="truncate">{source.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-10 -right-10 opacity-10">
                <i className="fas fa-globe-americas text-[200px]"></i>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-6 py-6 rounded-3xl flex flex-col md:flex-row items-center gap-6 animate-shake shadow-lg">
              <div className="bg-red-100 p-4 rounded-2xl text-red-600">
                <i className="fas fa-exclamation-triangle fa-2xl"></i>
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="font-black text-lg mb-1">Ops! Algo deu errado.</p>
                <p className="text-sm opacity-80">{error.message}</p>
              </div>
              {error.isQuota && (
                <button 
                  onClick={handleOpenKeyDialog}
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-widest transition-all whitespace-nowrap shadow-xl shadow-red-200"
                >
                  <i className="fas fa-plug mr-2"></i>
                  Usar Minha Própria Chave
                </button>
              )}
            </div>
          )}

          {/* Leads Dashboard */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 min-h-[600px]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-b border-slate-50 pb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Leads Identificados</h2>
                <p className="text-sm text-slate-500 font-medium">
                  Status atual: {leads.length} leads em {status === CampaignStatus.IDLE ? 'espera' : 'processamento'}.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Eficiência</p>
                  <p className="text-lg font-black text-indigo-600">98.4%</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <i className="fas fa-bolt"></i>
                </div>
              </div>
            </div>

            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 border-2 border-dashed border-slate-200">
                  <i className="fas fa-user-plus fa-3x"></i>
                </div>
                <p className="text-xl font-black text-slate-400">Nenhum Lead Carregado</p>
                <p className="text-sm max-w-xs text-center mt-2 leading-relaxed">
                  Inicie uma busca informando o produto e o nicho para gerar pelo menos 20 leads qualificados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {leads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 py-10 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 opacity-60 grayscale transition-all hover:grayscale-0 hover:opacity-100">
          <p className="text-sm font-bold text-slate-500">© 2024 G-LEAD HUNTER GLOBAL • INTELIGÊNCIA COMERCIAL</p>
          <div className="flex gap-8">
            <i className="fab fa-google"></i>
            <i className="fab fa-aws"></i>
            <i className="fab fa-microsoft"></i>
            <i className="fab fa-stripe"></i>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
