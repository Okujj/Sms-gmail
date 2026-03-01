
import React from 'react';
import { Lead } from '../types';

interface LeadCardProps {
  lead: Lead;
}

const LeadCard: React.FC<LeadCardProps> = ({ lead }) => {
  const getStatusColor = () => {
    switch (lead.status) {
      case 'valid': return 'bg-green-100 text-green-700 border-green-200';
      case 'invalid': return 'bg-red-100 text-red-700 border-red-200';
      case 'sending': return 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse';
      case 'sent': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'validating': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (lead.status) {
      case 'valid': return <i className="fas fa-check-circle mr-1"></i>;
      case 'invalid': return <i className="fas fa-times-circle mr-1"></i>;
      case 'sending': return <i className="fas fa-paper-plane mr-1"></i>;
      case 'sent': return <i className="fas fa-envelope-open mr-1"></i>;
      case 'validating': return <i className="fas fa-spinner fa-spin mr-1"></i>;
      default: return <i className="fas fa-user mr-1"></i>;
    }
  };

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold mr-3">
            {lead.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 leading-tight">{lead.name}</h3>
            <p className="text-xs text-slate-500">{lead.email}</p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full border font-medium uppercase tracking-wider ${getStatusColor()}`}>
          {getStatusIcon()} {lead.status}
        </span>
      </div>
      
      <div className="flex items-center gap-4 mt-2 text-xs">
        <div className="flex items-center text-slate-600">
          <i className="fas fa-calendar-alt mr-1 opacity-70"></i>
          <span>{lead.ageRange || 'N/A'}</span>
        </div>
        <div className="flex items-center text-slate-600 truncate max-w-[150px]">
          <i className="fas fa-link mr-1 opacity-70"></i>
          <span className="truncate">{lead.source || 'Manual'}</span>
        </div>
      </div>
      
      {lead.notes && (
        <p className="mt-3 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">
          {lead.notes}
        </p>
      )}
    </div>
  );
};

export default LeadCard;
