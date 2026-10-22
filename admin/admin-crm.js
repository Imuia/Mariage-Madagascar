/* Mariage Madagascar — Dynamic Isolated CRM Logic */
(function () {
  'use strict';

  // State Management
  let leadsData = [];
  let filteredLeads = [];
  let searchQuery = '';
  let selectedStatusFilter = 'all';
  let selectedPlannerFilter = 'all';

  // Toast Notification Helper
  function showToast(message, isError = false) {
    const toast = document.getElementById('mm-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `mm-toast ${isError ? 'mm-toast-error' : 'mm-toast-success'} show`;
    setTimeout(() => {
      toast.className = 'mm-toast';
    }, 4000);
  }

  // Get Supabase Client from MMAdminAuth or initialize fallback
  function getSupabase() {
    if (window.MMAdminAuth && typeof window.MMAdminAuth.getClient === 'function') {
      const client = window.MMAdminAuth.getClient();
      if (client) return client;
    }
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      const cfg = window.MARIAGE_SUPABASE || {
        url: 'https://qrkinjuhtyfptldlvdyg.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I'
      };
      return window.supabase.createClient(cfg.url, cfg.anonKey);
    }
    return null;
  }

  // Mapping columns to status categories
  // Columns:
  // 1: new (Nouveau): 'new', 'contacted'
  // 2: qualification (Qualification): 'qualified', 'meeting_scheduled'
  // 3: proposal_sent (Devis envoyé): 'proposal_sent', 'follow_up'
  // 4: negotiating (Négociation): 'negotiating'
  // 5: closed (Clôturé): 'confirmed', 'completed', 'lost_cancelled'

  function getColumnForStatus(status) {
    const s = (status || 'new').toLowerCase();
    if (['new', 'contacted'].includes(s)) return 'new';
    if (['qualified', 'meeting_scheduled'].includes(s)) return 'qualification';
    if (['proposal_sent', 'follow_up'].includes(s)) return 'proposal_sent';
    if (['negotiating'].includes(s)) return 'negotiating';
    if (['confirmed', 'completed', 'lost_cancelled'].includes(s)) return 'closed';
    return 'new';
  }

  function getDefaultStatusForColumn(columnId) {
    switch (columnId) {
      case 'new': return 'new';
      case 'qualification': return 'qualified';
      case 'proposal_sent': return 'proposal_sent';
      case 'negotiating': return 'negotiating';
      case 'closed': return 'confirmed';
      default: return 'new';
    }
  }

  // Format currency
  function formatMoney(amount) {
    if (amount === null || amount === undefined || amount === '' || isNaN(amount)) {
      return 'À définir';
    }
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  }

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return 'Date flexible';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  // Load Leads from Supabase
  async function loadLeads() {
    const supabase = getSupabase();
    const boardContainer = document.getElementById('crm-kanban-board');
    if (!supabase) {
      if (boardContainer) boardContainer.innerHTML = `<div class="p-8 text-center text-error">Erreur d'initialisation du client Supabase.</div>`;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('contact_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        showToast('Impossible de charger les demandes : ' + error.message, true);
        leadsData = [];
      } else {
        leadsData = data || [];
      }

      applyFiltersAndRender();
    } catch (err) {
      console.error('Load leads error:', err);
      showToast('Erreur lors du chargement des leads.', true);
      leadsData = [];
      applyFiltersAndRender();
    }
  }

  // Filter Logic
  function applyFiltersAndRender() {
    filteredLeads = leadsData.filter(lead => {
      // Search
      const search = searchQuery.toLowerCase();
      const matchSearch = !search ||
        (lead.name && lead.name.toLowerCase().includes(search)) ||
        (lead.email && lead.email.toLowerCase().includes(search)) ||
        (lead.phone && lead.phone.toLowerCase().includes(search)) ||
        (lead.destination && lead.destination.toLowerCase().includes(search)) ||
        (lead.project && lead.project.toLowerCase().includes(search));

      // Status Filter
      const status = (lead.status || 'new').toLowerCase();
      let matchStatus = true;
      if (selectedStatusFilter === 'hot') {
        matchStatus = (lead.estimated_budget && parseFloat(lead.estimated_budget) >= 15000);
      } else if (selectedStatusFilter === 'warm') {
        matchStatus = (lead.estimated_budget && parseFloat(lead.estimated_budget) >= 5000 && parseFloat(lead.estimated_budget) < 15000);
      } else if (selectedStatusFilter === 'cold') {
        matchStatus = (!lead.estimated_budget || parseFloat(lead.estimated_budget) < 5000);
      } else if (selectedStatusFilter !== 'all') {
        matchStatus = (status === selectedStatusFilter);
      }

      // Planner Filter
      let matchPlanner = true;
      if (selectedPlannerFilter !== 'all') {
        matchPlanner = (lead.assigned_planner === selectedPlannerFilter);
      }

      return matchSearch && matchStatus && matchPlanner;
    });

    // Update total count badge
    const badge = document.getElementById('crm-total-leads-badge');
    if (badge) {
      badge.textContent = `${filteredLeads.length} Lead${filteredLeads.length > 1 ? 's' : ''}`;
    }

    renderKanbanBoard();
  }

  // Render Kanban Board
  function renderKanbanBoard() {
    const columns = {
      new: { title: 'Nouveau', colorClass: 'bg-primary animate-pulse shadow-[0_0_8px_#7dd3fc]', leads: [] },
      qualification: { title: 'Qualification', colorClass: 'bg-secondary', leads: [] },
      proposal_sent: { title: 'Devis envoyé', colorClass: 'bg-tertiary', leads: [] },
      negotiating: { title: 'Négociation', colorClass: 'bg-outline', leads: [] },
      closed: { title: 'Clôturé', colorClass: 'bg-surface-variant border border-primary/20', leads: [] }
    };

    filteredLeads.forEach(lead => {
      const colId = getColumnForStatus(lead.status);
      if (columns[colId]) {
        columns[colId].leads.push(lead);
      } else {
        columns.new.leads.push(lead);
      }
    });

    const boardContainer = document.getElementById('crm-kanban-board');
    if (!boardContainer) return;

    let html = '';

    Object.keys(columns).forEach(colId => {
      const col = columns[colId];
      html += `
        <div class="w-[320px] min-w-[320px] flex flex-col h-full bg-surface-container-low/40 backdrop-blur-sm rounded-xl border border-primary/5 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)] overflow-hidden crm-col" data-column-id="${colId}">
          <div class="px-4 py-3 border-b border-primary/10 flex justify-between items-center bg-surface-container/40 shrink-0">
            <h3 class="font-semibold text-on-surface flex items-center gap-2">
              <span class="w-2 h-2 rounded-full ${col.colorClass}"></span>
              ${col.title}
            </h3>
            <span class="bg-surface border border-primary/10 text-on-surface-variant text-xs font-medium px-2 py-0.5 rounded-full">${col.leads.length}</span>
          </div>
          <div class="flex-1 overflow-y-auto hide-scroll p-3 flex flex-col gap-3 crm-droppable-area" data-column-id="${colId}" style="min-height: 400px;">
      `;

      if (col.leads.length === 0) {
        html += `
          <div class="flex-1 flex flex-col items-center justify-center text-center opacity-40 p-4 border border-dashed border-primary/10 rounded-lg my-auto">
            <span class="material-symbols-outlined text-3xl mb-1 text-on-surface-variant">inbox</span>
            <p class="text-xs text-on-surface-variant">Aucun lead pour le moment.</p>
          </div>
        `;
      } else {
        col.leads.forEach(lead => {
          const isClosed = colId === 'closed';
          const isLost = isClosed && lead.status === 'lost_cancelled';
          const isWon = isClosed && (lead.status === 'confirmed' || lead.status === 'completed');

          html += `
            <div class="bg-surface/70 backdrop-blur-md border ${isLost ? 'border-error/30' : isWon ? 'border-primary/40' : 'border-primary/15'} rounded-lg p-4 flex flex-col gap-3 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:border-primary/50 hover:shadow-[0_0_20px_rgba(125,211,252,0.15)] transition-all duration-300 cursor-grab active:cursor-grabbing group relative overflow-hidden crm-card"
                 draggable="true"
                 data-lead-id="${lead.id}">

              ${isWon ? `<div class="absolute top-0 right-0 w-0 h-0 border-t-[30px] border-l-[30px] border-t-primary/30 border-l-transparent"></div>
              <span class="material-symbols-outlined absolute top-1 right-1 text-[12px] text-primary">check</span>` : ''}

              ${isLost ? `<div class="absolute top-0 right-0 w-0 h-0 border-t-[30px] border-l-[30px] border-t-error/30 border-l-transparent"></div>
              <span class="material-symbols-outlined absolute top-1 right-1 text-[12px] text-error">close</span>` : ''}

              <div class="flex justify-between items-start gap-2">
                <h4 class="font-semibold text-on-surface text-sm group-hover:text-primary transition-colors cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap" data-action="edit" data-lead-id="${lead.id}">
                  ${escapeHtml(lead.name || 'Prospect sans nom')}
                </h4>
                <div class="relative group/menu">
                  <button class="text-on-surface-variant hover:text-primary transition-colors p-1" data-action="quick-menu" data-lead-id="${lead.id}">
                    <span class="material-symbols-outlined text-[16px]">more_horiz</span>
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5 text-xs text-on-surface-variant">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[14px] text-tertiary">location_on</span>
                  <span class="truncate">${escapeHtml(lead.destination || 'Destination N/C')}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[14px]">event</span>
                  <span>${formatDate(lead.target_date || lead.created_at)}</span>
                </div>
                ${lead.project ? `
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[14px] text-secondary">favorite</span>
                  <span class="truncate">${escapeHtml(lead.project)}</span>
                </div>` : ''}
              </div>

              <div class="mt-2 flex justify-between items-end border-t border-primary/10 pt-3">
                <div class="flex flex-col">
                  <span class="text-[10px] text-on-surface-variant uppercase tracking-wider">Budget Est.</span>
                  <span class="text-primary font-medium text-sm">${formatMoney(lead.estimated_budget)}</span>
                </div>
                <div class="flex items-center gap-2">
                  ${lead.assigned_planner ? `
                    <span class="text-[10px] px-2 py-0.5 rounded bg-surface-container border border-primary/20 text-on-surface-variant" title="Planner assigné">
                      ${escapeHtml(lead.assigned_planner)}
                    </span>
                  ` : `
                    <span class="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-primary/20 text-on-surface-variant/60" title="Non assigné">
                      Non assigné
                    </span>
                  `}
                </div>
              </div>
            </div>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;
    });

    boardContainer.innerHTML = html;
    attachDragAndDropHandlers();
  }

  // Helper Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Drag and Drop Logic
  let draggedCardId = null;

  function attachDragAndDropHandlers() {
    const cards = document.querySelectorAll('.crm-card');
    const droppableAreas = document.querySelectorAll('.crm-droppable-area');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedCardId = card.getAttribute('data-lead-id');
        e.dataTransfer.setData('text/plain', draggedCardId);
        card.classList.add('opacity-50', 'scale-95');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('opacity-50', 'scale-95');
        draggedCardId = null;
      });
    });

    droppableAreas.forEach(area => {
      area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('bg-primary/5');
      });

      area.addEventListener('dragleave', () => {
        area.classList.remove('bg-primary/5');
      });

      area.addEventListener('drop', async (e) => {
        e.preventDefault();
        area.classList.remove('bg-primary/5');

        const leadId = e.dataTransfer.getData('text/plain') || draggedCardId;
        const targetColumnId = area.getAttribute('data-column-id');

        if (!leadId || !targetColumnId) return;

        const lead = leadsData.find(l => String(l.id) === String(leadId));
        if (!lead) return;

        const oldStatus = lead.status;
        const newStatus = getDefaultStatusForColumn(targetColumnId);

        if (oldStatus === newStatus) return;

        // Optimistic UI Update
        lead.status = newStatus;
        applyFiltersAndRender();

        // Server Update
        const supabase = getSupabase();
        if (!supabase) return;

        try {
          const { error } = await supabase
            .from('contact_requests')
            .update({ status: newStatus })
            .eq('id', leadId);

          if (error) {
            console.error('Status update failed:', error);
            showToast('Échec de la mise à jour du statut : ' + error.message, true);
            lead.status = oldStatus; // Rollback
            applyFiltersAndRender();
          } else {
            showToast(`Statut de ${lead.name || 'Prospect'} mis à jour.`);
          }
        } catch (err) {
          console.error('Status update exception:', err);
          showToast('Erreur lors de la mise à jour.', true);
          lead.status = oldStatus; // Rollback
          applyFiltersAndRender();
        }
      });
    });
  }

  // Open Lead Modal (Create or Edit)
  function openLeadModal(lead = null) {
    const isEdit = !!lead;
    let modal = document.getElementById('crm-lead-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'crm-lead-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="bg-surface-container-high border border-primary/20 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col gap-6 relative">
        <button id="crm-modal-close" class="absolute top-4 right-4 text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>

        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined">${isEdit ? 'edit_note' : 'person_add'}</span>
          </div>
          <div>
            <h3 class="text-xl font-semibold text-on-surface font-headline">${isEdit ? 'Détails du Lead' : 'Créer un nouveau Prospect'}</h3>
            <p class="text-xs text-on-surface-variant">${isEdit ? 'Consulter et modifier les informations du dossier' : 'Saisissez les informations de la demande client'}</p>
          </div>
        </div>

        <form id="crm-lead-form" class="flex flex-col gap-4">
          <input type="hidden" name="id" value="${lead ? lead.id : ''}">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">Nom complet *</label>
              <input type="text" name="name" required value="${escapeHtml(lead ? lead.name : '')}" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">E-mail *</label>
              <input type="email" name="email" required value="${escapeHtml(lead ? lead.email : '')}" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">Téléphone *</label>
              <input type="text" name="phone" required value="${escapeHtml(lead ? lead.phone : '')}" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">Destination *</label>
              <input type="text" name="destination" required value="${escapeHtml(lead ? lead.destination : 'Nosy Be')}" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">Projet *</label>
              <input type="text" name="project" required value="${escapeHtml(lead ? lead.project : 'Mariage')}" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">Statut commercial</label>
              <select name="status" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">
                <option value="new" ${lead && lead.status === 'new' ? 'selected' : ''}>Nouveau</option>
                <option value="contacted" ${lead && lead.status === 'contacted' ? 'selected' : ''}>Contacté</option>
                <option value="qualified" ${lead && lead.status === 'qualified' ? 'selected' : ''}>Qualifié</option>
                <option value="meeting_scheduled" ${lead && lead.status === 'meeting_scheduled' ? 'selected' : ''}>RDV Planifié</option>
                <option value="proposal_sent" ${lead && lead.status === 'proposal_sent' ? 'selected' : ''}>Devis envoyé</option>
                <option value="follow_up" ${lead && lead.status === 'follow_up' ? 'selected' : ''}>Relancé</option>
                <option value="negotiating" ${lead && lead.status === 'negotiating' ? 'selected' : ''}>Négociation</option>
                <option value="confirmed" ${lead && lead.status === 'confirmed' ? 'selected' : ''}>Confirmé / Gagné</option>
                <option value="completed" ${lead && lead.status === 'completed' ? 'selected' : ''}>Terminé</option>
                <option value="lost_cancelled" ${lead && lead.status === 'lost_cancelled' ? 'selected' : ''}>Perdu / Annulé</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">Budget Estimé (€)</label>
              <input type="number" name="estimated_budget" step="100" value="${lead && lead.estimated_budget ? lead.estimated_budget : ''}" placeholder="Ex: 15000" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-medium text-on-surface-variant mb-1">Wedding Planner Assigné</label>
              <select name="assigned_planner" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">
                <option value="">Non assigné</option>
                <option value="Sophie L." ${lead && lead.assigned_planner === 'Sophie L.' ? 'selected' : ''}>Sophie L.</option>
                <option value="Marc D." ${lead && lead.assigned_planner === 'Marc D.' ? 'selected' : ''}>Marc D.</option>
                <option value="Elena R." ${lead && lead.assigned_planner === 'Elena R.' ? 'selected' : ''}>Elena R.</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-on-surface-variant mb-1">Vision / Notes du client</label>
            <textarea name="vision" rows="3" class="w-full bg-surface/50 border border-primary/15 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none">${escapeHtml(lead ? lead.vision : '')}</textarea>
          </div>

          <div class="flex justify-end gap-3 mt-4 pt-4 border-t border-primary/10">
            <button type="button" id="crm-modal-cancel" class="px-4 py-2 rounded-lg text-sm font-medium border border-primary/20 text-on-surface-variant hover:bg-surface-container transition-colors">Annuler</button>
            <button type="submit" id="crm-modal-submit" class="px-5 py-2 rounded-lg text-sm font-medium bg-primary text-background hover:bg-primary/90 transition-colors flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">save</span>
              ${isEdit ? 'Enregistrer les modifications' : 'Créer le Prospect'}
            </button>
          </div>
        </form>
      </div>
    `;

    // Close Handler
    const closeModal = () => modal.remove();
    document.getElementById('crm-modal-close').addEventListener('click', closeModal);
    document.getElementById('crm-modal-cancel').addEventListener('click', closeModal);

    // Form Submission
    const form = document.getElementById('crm-lead-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('crm-modal-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Enregistrement...';

      const formData = new FormData(form);
      const payload = {
        name: formData.get('name').trim(),
        email: formData.get('email').trim().toLowerCase(),
        phone: formData.get('phone').trim(),
        destination: formData.get('destination').trim(),
        project: formData.get('project').trim(),
        status: formData.get('status'),
        estimated_budget: formData.get('estimated_budget') ? parseFloat(formData.get('estimated_budget')) : null,
        assigned_planner: formData.get('assigned_planner') || null,
        vision: formData.get('vision').trim()
      };

      const supabase = getSupabase();
      if (!supabase) {
        showToast('Supabase indisponible.', true);
        submitBtn.disabled = false;
        return;
      }

      try {
        if (isEdit) {
          const id = formData.get('id');
          const { error } = await supabase
            .from('contact_requests')
            .update(payload)
            .eq('id', id);

          if (error) throw error;
          showToast('Prospect mis à jour avec succès.');
        } else {
          const { error } = await supabase
            .from('contact_requests')
            .insert([payload]);

          if (error) throw error;
          showToast('Nouveau prospect créé avec succès.');
        }

        closeModal();
        await loadLeads();
      } catch (err) {
        console.error('Save lead error:', err);
        showToast('Erreur lors de l’enregistrement : ' + (err.message || err), true);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Initialize UI Events
  function initEvents() {
    // Search input binding
    const searchInput = document.querySelector('main input[placeholder*="Rechercher"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        applyFiltersAndRender();
      });
    }

    // Status Filter binding
    const statusSelect = document.querySelector('main select option[value="hot"]')?.closest('select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        selectedStatusFilter = e.target.value;
        applyFiltersAndRender();
      });
    }

    // Planner Filter binding
    const plannerSelect = document.querySelector('main select option[value="1"]')?.closest('select');
    if (plannerSelect) {
      plannerSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '1') selectedPlannerFilter = 'Sophie L.';
        else if (val === '2') selectedPlannerFilter = 'Marc D.';
        else if (val === '3') selectedPlannerFilter = 'Elena R.';
        else selectedPlannerFilter = 'all';
        applyFiltersAndRender();
      });
    }

    // "Nouveau Lead" Button
    const addBtn = document.querySelector('button[data-demo-action=""]');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openLeadModal(null);
      });
    }

    // Delegation for clicking card edit action
    document.addEventListener('click', (e) => {
      const editTrigger = e.target.closest('[data-action="edit"], [data-action="quick-menu"]');
      if (editTrigger) {
        const leadId = editTrigger.getAttribute('data-lead-id');
        const lead = leadsData.find(l => String(l.id) === String(leadId));
        if (lead) {
          openLeadModal(lead);
        }
      }
    });
  }

  // Initialize CRM Module
  function initCRM() {
    initEvents();
    loadLeads();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCRM);
  } else {
    initCRM();
  }
})();
