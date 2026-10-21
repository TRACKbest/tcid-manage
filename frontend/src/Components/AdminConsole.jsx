import React, { useEffect, useState } from 'react'
import './AdminConsole.css'
import RichTextEditor from './RichTextEditor'
import confirmLogout from './confirmLogout'
import AdminPayments from './AdminPayments'
import { formatAriary } from './format'

const apiBase = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api`

const adminTranslations = {
  apps: {
    auth: 'Comptes et permissions',
    main: 'Gestion pédagogique',
  },
  models: {
    teacher: 'Formateurs',
    coursecategory: 'Catégories de formations',
    course: 'Formations',
    chapter: 'Vidéos des formations',
    chapterdocument: 'Documents des vidéos',
    coursepayment: 'Paiements des formations',
    student: 'Apprenants',
    studentcourseenrollment: 'Inscriptions aux formations',
    courserating: 'Avis sur les formations',
    studentfavoritecourse: 'Formations favorites',
    courseview: 'Consultations des formations',
    liveclassroom: 'Classes virtuelles',
    liveclasspoll: 'Sondages en direct',
    liveclasspollvote: 'Votes aux sondages',
    studentassignment: 'Devoirs',
    quiz: 'Questionnaires',
    quizquestions: 'Questions des questionnaires',
    coursequiz: 'Questionnaires des formations',
    attemptquiz: 'Tentatives de questionnaires',
    studymaterial: 'Ressources pédagogiques',
    aicachedresponse: 'Réponses IA mises en cache',
    aiassistantquestion: 'Questions adressées à l’assistant IA',
    faq: 'Questions fréquentes',
    learninggroup: 'Groupes de discussion',
    groupmembership: 'Membres des groupes',
    groupmessage: 'Messages de groupe',
    teacherstudentchat: 'Messages formateur-apprenant',
    notification: 'Notifications',
    group: 'Groupes',
    user: 'Utilisateurs',
    site: 'Sites',
  },
  fields: {
    id: 'Identifiant',
    title: 'Titre',
    detail: 'Détails',
    description: 'Description',
    fullname: 'Nom complet',
    full_name: 'Nom complet',
    first_name: 'Prénom',
    last_name: 'Nom',
    username: 'Nom d’utilisateur',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    password1: 'Mot de passe',
    password2: 'Confirmer le mot de passe',
    usable_password: 'Définir un mot de passe utilisable',
    is_active: 'Compte actif',
    is_approved: 'Compte approuvé',
    is_staff: 'Accès administrateur',
    is_superuser: 'Superadministrateur',
    date_joined: 'Date d’inscription',
    last_login: 'Dernière connexion',
    qualification: 'Qualifications',
    mobile_no: 'Téléphone',
    profile_img: 'Photo de profil',
    face_url: 'Lien Facebook',
    insta_url: 'Lien Instagram',
    twit_url: 'Lien Twitter',
    web_url: 'Site web',
    you_url: 'Lien YouTube',
    skills: 'Compétences',
    category: 'Catégorie',
    teacher: 'Formateur',
    student: 'Apprenant',
    course: 'Formation',
    quiz: 'Questionnaire',
    question: 'Question',
    questions: 'Questions',
    right_ans: 'Bonne réponse',
    ans1: 'Choix 1',
    ans2: 'Choix 2',
    ans3: 'Choix 3',
    ans4: 'Choix 4',
    enrolled_time: 'Date d’inscription',
    add_time: 'Date d’ajout',
    created_at: 'Date de création',
    updated_at: 'Date de modification',
    viewed_at: 'Date de consultation',
    scheduled_at: 'Date prévue',
    started_at: 'Date de début',
    ended_at: 'Date de fin',
    status: 'Statut',
    is_read: 'Lu',
    student_status: 'Devoir terminé',
    interseted_categories: 'Catégories d’intérêt',
    featured_img: 'Image de couverture',
    techs: 'Technologies',
    course_views: 'Nombre de consultations',
    rating: 'Note',
    reviews: 'Avis',
    review_time: 'Date de l’avis',
    remarks: 'Remarques',
    upload: 'Fichier',
    ai_summary: 'Résumé IA',
    extracted_text: 'Texte extrait',
    answer: 'Réponse',
    answer_preview: 'Réponse',
    cover_image: 'Image de couverture',
    group: 'Groupe',
    added_at: 'Date d’ajout',
    member_count: 'Nombre de membres',
    feature: 'Fonctionnalité',
    cache_key: 'Clé de cache',
    response: 'Réponse',
    metadata: 'Métadonnées',
    topic: 'Thème',
    msg_to: 'Message',
    msg_from: 'Expéditeur',
    msg_time: 'Date du message',
    edited_at: 'Date de modification',
    subject: 'Sujet',
    message: 'Message',
    link: 'Lien',
    domain: 'Nom de domaine',
    name: 'Nom',
    content: 'Contenu',
    url: 'Adresse web',
    sites: 'Sites associés',
    groups: 'Groupes',
    user_permissions: 'Autorisations',
    permissions: 'Autorisations',
    poll: 'Sondage',
    classroom: 'Classe virtuelle',
    options: 'Choix de réponse',
    option_index: 'Numéro du choix',
    created: 'Date de création',
    price: 'Prix (Ar)',
    position: 'Ordre',
    is_free_preview: 'Vidéo gratuite',
    chapter: 'Vidéo',
    method: 'Opérateur',
    amount: 'Montant',
    reference: 'Référence',
  },
  choices: {
    Pending: 'En attente',
    pending: 'En attente',
    Approved: 'Approuvé',
    approved: 'Approuvé',
    Rejected: 'Refusé',
    rejected: 'Refusé',
    Scheduled: 'Planifié',
    scheduled: 'Planifié',
    Live: 'En direct',
    live: 'En direct',
    Ended: 'Terminé',
    ended: 'Terminé',
    Tutor: 'Tuteur',
    tutor: 'Tuteur',
    Feedback: 'Retour pédagogique',
    feedback: 'Retour pédagogique',
    Code: 'Programmation',
    code: 'Programmation',
    Concept: 'Concept',
    concept: 'Concept',
    Exam: 'Examen',
    exam: 'Examen',
    Setup: 'Configuration',
    setup: 'Configuration',
    Other: 'Autre',
    other: 'Autre',
    True: 'Oui',
    False: 'Non',
    Validated: 'Validé',
    validated: 'Validé',
    orange_money: 'Orange Money',
    airtel_money: 'Airtel Money',
    mvola: 'MVola',
  },
  errors: {
    'Authentication required.': 'Veuillez vous connecter pour accéder à l’administration.',
    'Staff access required.': 'Un accès administrateur est requis.',
    'Invalid request.': 'La requête est invalide.',
    'Invalid staff credentials.': 'Identifiant ou mot de passe incorrect.',
    'Unknown account type.': 'Type de compte inconnu.',
    'View permission required.': 'Vous n’avez pas l’autorisation de consulter ces données.',
    'Add permission required.': 'Vous n’avez pas l’autorisation d’ajouter cet élément.',
    'Change permission required.': 'Vous n’avez pas l’autorisation de modifier cet élément.',
    'Delete permission required.': 'Vous n’avez pas l’autorisation de supprimer cet élément.',
    'This field is required.': 'Ce champ est obligatoire.',
    'Enter a valid email address.': 'Saisissez une adresse e-mail valide.',
    'Enter a valid URL.': 'Saisissez une adresse web valide.',
    'Ensure this value has at most': 'La valeur saisie dépasse la longueur maximale autorisée.',
    'Select a valid choice.': 'Sélectionnez une option valide.',
  },
}

function csrfToken() {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('csrftoken='))
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''
}

async function adminRequest(path, options = {}) {
  const headers = { ...options.headers }
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (options.method && options.method !== 'GET') headers['X-CSRFToken'] = csrfToken()

  const response = await fetch(`${apiBase}/admin-ui/${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(adminTranslations.errors[data.detail] || data.detail || 'La requête a échoué.')
    error.data = data
    throw error
  }
  return data
}

function resourceKey(resource) {
  return `${resource.appLabel}/${resource.modelName}`
}

function translateAppLabel(label) {
  return adminTranslations.apps[label] || label
}

function translateResource(resource) {
  return { ...resource, label: adminTranslations.models[resource.modelName] || resource.label }
}

function translateResourceData(resource) {
  return {
    ...translateResource(resource),
    columns: resource.columns.map((column) => ({
      ...column,
      label: adminTranslations.fields[column.name] || column.label,
    })),
    fields: resource.fields.map((field) => ({
      ...field,
      label: resource.modelName === 'learninggroup' && field.name === 'name'
        ? 'Nom du groupe'
        : adminTranslations.fields[field.name] || field.label,
      choices: field.choices.map((choice) => ({
        ...choice,
        label: adminTranslations.choices[choice.label] || choice.label,
      })),
    })),
  }
}

function translateFieldError(name, errors) {
  const label = adminTranslations.fields[name] || name
  const messages = errors.map((item) => {
    const knownTranslation = adminTranslations.errors[item.message]
    if (knownTranslation) return knownTranslation
    if (item.message.startsWith('Ensure this value has at most')) {
      return 'La valeur saisie dépasse la longueur maximale autorisée.'
    }
    return item.message
  })
  return `${label} : ${messages.join(', ')}`
}

function displayValue(value) {
  if (value === true) return 'Oui'
  if (value === false) return 'Non'
  if (value === null || value === undefined || value === '') return '—'
  const text = String(value)
  return adminTranslations.choices[text] || text
}

function AdminLogin({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')
    try {
      await adminRequest('login/', { method: 'POST', body: JSON.stringify(credentials) })
      onLogin()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-panel" onSubmit={submit}>
        <img className="admin-brand-mark" src="/tcid-center-logo.png" alt="TCiD Center" />
        <p className="admin-kicker">ESPACE ADMINISTRATEUR</p>
        <h1>Administration</h1>
        <label>Identifiant<input autoComplete="username" required value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label>
        <label>Mot de passe<input type="password" autoComplete="current-password" required value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
        {errorMessage && <p className="admin-error" role="alert">{errorMessage}</p>}
        <button className="admin-login-submit" type="submit" disabled={submitting}>{submitting ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </main>
  )
}

function RevenueChart({ months }) {
  const max = Math.max(1, ...months.map((item) => item.total))
  if (!months.length) return <p className="admin-frequent-empty">Aucun paiement validé pour le moment.</p>
  return (
    <div className="admin-bar-chart" role="img" aria-label="Revenus validés des derniers mois">
      {months.map((item) => (
        <div className="admin-bar" key={item.month} title={`${item.month} : ${formatAriary(item.total)} (${item.count} paiement(s))`}>
          <span className="admin-bar-value">{formatAriary(item.total)}</span>
          <div className="admin-bar-track"><i style={{ height: `${Math.max(4, Math.round(item.total * 100 / max))}%` }} /></div>
          <span className="admin-bar-label">{item.month}</span>
        </div>
      ))}
    </div>
  )
}

function AdminConsole() {
  const [view, setView] = useState('overview')
  const [stats, setStats] = useState(null)
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [resources, setResources] = useState([])
  const [frequentQuestions, setFrequentQuestions] = useState([])
  const [groupPanel, setGroupPanel] = useState(null)
  const [groupFilter, setGroupFilter] = useState('all_students')
  const [groupCourseId, setGroupCourseId] = useState('')
  const [groupCandidates, setGroupCandidates] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
  const [groupCourses, setGroupCourses] = useState([])
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [groupLoading, setGroupLoading] = useState(false)
  const [selectedResource, setSelectedResource] = useState(null)
  const [resourceData, setResourceData] = useState(null)
  const [records, setRecords] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [search, setSearch] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState(null)
  const [formValues, setFormValues] = useState({})
  const [formFiles, setFormFiles] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      try {
        await adminRequest('csrf/')
        const session = await adminRequest('session/')
        if (!cancelled) setUser(session)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setInitializing(false)
      }
    }
    initialize()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!user) {
      setResources([])
      setSelectedResource(null)
      return
    }
    let cancelled = false
    adminRequest('resources/')
      .then((data) => {
        if (cancelled) return
        setResources(data.resources.map(translateResource))
        setFrequentQuestions(data.frequentQuestions || [])
        setStats(data.stats || null)
      })
      .catch((error) => {
        if (!cancelled) setPageError(error.message)
      })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user || !selectedResource) {
      setResourceData(null)
      setRecords([])
      return
    }
    let cancelled = false
    setPageLoading(true)
    setPageError('')
    const query = new URLSearchParams({ page: String(page) })
    if (search.trim()) query.set('q', search.trim())
    if (pendingOnly) query.set('pending', '1')
    adminRequest(`resources/${resourceKey(selectedResource)}/?${query}`)
      .then((data) => {
        if (cancelled) return
        setResourceData(translateResourceData(data.resource))
        setRecords(data.results)
        setTotalRecords(data.total)
      })
      .catch((error) => {
        if (!cancelled) setPageError(error.message)
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false)
      })
    return () => { cancelled = true }
  }, [user, selectedResource, page, search, pendingOnly, refreshKey])

  useEffect(() => {
    if (!user || !groupPanel) return
    let cancelled = false
    setGroupLoading(true)
    const query = new URLSearchParams({ filter: groupFilter })
    if (groupCourseId) query.set('course_id', groupCourseId)
    adminRequest(`groups/${groupPanel.id}/members/?${query}`)
      .then((data) => {
        if (cancelled) return
        setGroupCandidates(data.candidates)
        setGroupMembers(data.members)
        setGroupCourses(data.courses)
        setSelectedMemberIds([])
      })
      .catch((error) => {
        if (!cancelled) setPageError(error.message)
      })
      .finally(() => {
        if (!cancelled) setGroupLoading(false)
      })
    return () => { cancelled = true }
  }, [user, groupPanel, groupFilter, groupCourseId, refreshKey])

  const chooseResource = (resource, showPending = false) => {
    setView(resource ? 'resource' : 'overview')
    setSelectedResource(resource)
    setGroupPanel(null)
    setPendingOnly(showPending)
    setSearch('')
    setPage(1)
    setNotice('')
  }

  const updateResources = async () => {
    const data = await adminRequest('resources/')
    setResources(data.resources.map(translateResource))
    setFrequentQuestions(data.frequentQuestions || [])
    setStats(data.stats || null)
  }

  const openPayments = () => {
    setSelectedResource(null)
    setGroupPanel(null)
    setNotice('')
    setView('payments')
  }

  const addGroupMembers = async () => {
    if (!groupPanel || !selectedMemberIds.length) return
    try {
      const result = await adminRequest(`groups/${groupPanel.id}/members/`, {
        method: 'POST',
        body: JSON.stringify({
          filter: groupFilter,
          courseId: groupCourseId,
          candidateIds: selectedMemberIds,
        }),
      })
      setNotice(`${result.added} membre(s) ajouté(s) au groupe.`)
      setRefreshKey((current) => current + 1)
      await updateResources()
    } catch (error) {
      setPageError(error.message)
    }
  }

  const logout = async () => {
    if (!(await confirmLogout('Vous allez quitter la console d’administration.'))) return
    try {
      await adminRequest('logout/', { method: 'POST' })
    } finally {
      setUser(null)
      setSelectedResource(null)
    }
  }

  const openEditor = async (recordId = null) => {
    if (!selectedResource) return
    const endpoint = `resources/${resourceKey(selectedResource)}/${recordId || 'new'}/`
    setFormError('')
    try {
      const data = await adminRequest(endpoint)
      const initialValues = Object.fromEntries(data.resource.fields.map((field) => [field.name, field.initial ?? '']))
      setFormValues(initialValues)
      setFormFiles({})
      setEditor({ endpoint, recordId, resource: translateResourceData(data.resource) })
    } catch (error) {
      setPageError(error.message)
    }
  }

  const saveRecord = async (event) => {
    event.preventDefault()
    if (!editor) return
    setSaving(true)
    setFormError('')
    const body = new FormData()
    editor.resource.fields.forEach((field) => {
      if (field.disabled) return
      if (field.type === 'file') {
        if (formFiles[field.name]) body.append(field.name, formFiles[field.name])
        return
      }
      const value = formValues[field.name]
      if (field.type === 'multiselect') {
        (value || []).forEach((item) => body.append(field.name, item))
      } else if (field.type === 'boolean') {
        body.append(field.name, value ? 'true' : 'false')
      } else if (value !== null && value !== undefined) {
        body.append(field.name, value)
      }
    })
    try {
      const result = await adminRequest(editor.endpoint, { method: 'POST', body })
      setEditor(null)
      setNotice(result.created
        ? `${result.created} devoir(s) individuel(s) créé(s) et envoyé(s) au groupe.`
        : editor.recordId ? 'Modification enregistrée.' : 'Élément créé.')
      setRefreshKey((current) => current + 1)
      await updateResources()
    } catch (error) {
      const fieldErrors = error.data?.errors
      setFormError(fieldErrors
        ? Object.entries(fieldErrors).map(([name, errors]) => translateFieldError(name, errors)).join(' · ')
        : error.message)
    } finally {
      setSaving(false)
    }
  }

  const isGroupAssignment = editor?.resource.modelName === 'studentassignment' && Boolean(formValues.group)

  const deleteRecord = async (record) => {
    if (!selectedResource || !window.confirm(`Supprimer l’élément ${record.id} ?`)) return
    const body = new FormData()
    body.append('_action', 'delete')
    try {
      await adminRequest(`resources/${resourceKey(selectedResource)}/${record.id}/`, { method: 'POST', body })
      setNotice('Élément supprimé.')
      setRefreshKey((current) => current + 1)
      await updateResources()
    } catch (error) {
      setPageError(error.message)
    }
  }

  const approveRecord = async (record) => {
    if (!selectedResource) return
    try {
      await adminRequest(`approvals/${selectedResource.modelName}/${record.id}/`, { method: 'POST' })
      setNotice('Compte approuvé et activé.')
      setPendingOnly(true)
      setRefreshKey((current) => current + 1)
      await updateResources()
    } catch (error) {
      setPageError(error.message)
    }
  }

  if (initializing) return <main className="admin-loading">Chargement de la console…</main>
  if (!user) return <AdminLogin onLogin={() => adminRequest('session/').then(setUser)} />

  const resourcesByApp = resources.reduce((groups, resource) => {
    groups[resource.appLabel] = [...(groups[resource.appLabel] || []), resource]
    return groups
  }, {})

  return (
    <div className="admin-console">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><img className="admin-brand-mark" src="/tcid-center-logo.png" alt="TCiD Center" /><span>Administration</span></div>
        <button className={`admin-nav-item ${view === 'overview' ? 'is-active' : ''}`} onClick={() => chooseResource(null)}><span><span className="admin-nav-symbol">⌂</span> Tableau de bord</span></button>
        <button className={`admin-nav-item ${view === 'payments' ? 'is-active' : ''}`} onClick={openPayments}><span><span className="admin-nav-symbol">₳</span> Paiements</span>{stats?.pendingPayments > 0 && <span className="admin-nav-count is-alert">{stats.pendingPayments}</span>}</button>
        <div className="admin-sidebar-scroll">
          {Object.entries(resourcesByApp).map(([appLabel, appResources]) => (
            <section className="admin-nav-group" key={appLabel}>
              <h2>{translateAppLabel(appLabel)}</h2>
              {appResources.map((resource) => (
                <button className={`admin-nav-item ${selectedResource && resourceKey(selectedResource) === resourceKey(resource) ? 'is-active' : ''}`} key={resourceKey(resource)} onClick={() => chooseResource(resource)}>
                  <span>{resource.label}</span><span className="admin-nav-count">{resource.pendingCount || resource.count}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
        <button className="admin-logout-button" onClick={logout}>Déconnexion</button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><p className="admin-kicker">CONSOLE DE GESTION</p><strong>Bonjour, {user.username}</strong></div>
          <span className="admin-user-chip">{user.username}</span>
        </header>
        <div className="admin-workspace">
          {notice && <div className="admin-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
          {pageError && <div className="admin-alert" role="alert">{pageError}<button onClick={() => setPageError('')} aria-label="Fermer">×</button></div>}

          {view === 'payments' ? (
            <AdminPayments request={adminRequest} onChanged={updateResources} />
          ) : !selectedResource ? (
            <section className="admin-overview">
              <div className="admin-page-heading"><div><p className="admin-kicker">ESPACE ADMINISTRATEUR</p><h1>Tableau de bord</h1></div><p>{resources.length} modules · données en temps réel</p></div>
              {stats && (
                <>
                  <div className="admin-kpi-grid">
                    <button type="button" className={`admin-kpi ${stats.pendingPayments ? 'is-alert' : ''}`} onClick={openPayments}>
                      <span>Paiements à vérifier</span><strong>{stats.pendingPayments}</strong><small>{stats.pendingPayments ? 'Ouvrir la file de validation →' : 'Tout est à jour'}</small>
                    </button>
                    <div className="admin-kpi is-money"><span>Revenus ce mois</span><strong>{formatAriary(stats.revenueThisMonth)}</strong><small>Total : {formatAriary(stats.revenueTotal)}</small></div>
                    <div className="admin-kpi"><span>Paiements validés</span><strong>{stats.validatedPayments}</strong><small>{stats.paidCourses} formation(s) payante(s)</small></div>
                    <div className="admin-kpi"><span>Apprenants</span><strong>{stats.students}</strong><small>{stats.approvedEnrollments} inscription(s) active(s)</small></div>
                    <div className="admin-kpi"><span>Formateurs</span><strong>{stats.teachers}</strong><small>{stats.courses} formation(s)</small></div>
                    <div className="admin-kpi"><span>Classes en direct</span><strong>{stats.liveNow}</strong><small>{stats.liveNow ? 'Session(s) en cours' : 'Aucune session en cours'}</small></div>
                  </div>
                  <div className="admin-overview-columns">
                    <section className="admin-frequent-questions">
                      <div className="admin-frequent-heading"><div><p className="admin-kicker">FINANCES</p><h2>Revenus validés par mois</h2></div></div>
                      <RevenueChart months={stats.revenueByMonth || []} />
                    </section>
                    <section className="admin-frequent-questions">
                      <div className="admin-frequent-heading"><div><p className="admin-kicker">CLASSEMENT</p><h2>Formations les plus vendues</h2></div></div>
                      {stats.topCourses?.length ? (
                        <ol className="admin-top-list">
                          {stats.topCourses.map((item) => (
                            <li key={item.course__title}><span><strong>{item.course__title}</strong><small>{item.course__teacher__full_name} · {item.count} vente(s)</small></span><b>{formatAriary(item.total)}</b></li>
                          ))}
                        </ol>
                      ) : <p className="admin-frequent-empty">Les ventes apparaîtront ici après la première validation.</p>}
                    </section>
                  </div>
                </>
              )}
              <div className="admin-metric-grid">
                {resources.filter((resource) => resource.pendingCount > 0).map((resource) => (
                  <button className="admin-metric" key={resourceKey(resource)} onClick={() => chooseResource(resource, true)}>
                    <span className="admin-metric-label">À approuver · {resource.label}</span><strong>{resource.pendingCount}</strong><span>Ouvrir les demandes →</span>
                  </button>
                ))}
                <div className="admin-metric admin-metric-neutral"><span className="admin-metric-label">Enregistrements gérés</span><strong>{resources.reduce((total, resource) => total + resource.count, 0)}</strong><span>Dans {resources.length} modules</span></div>
              </div>
              <section className="admin-frequent-questions">
                <div className="admin-frequent-heading">
                  <div><p className="admin-kicker">ANALYSE PÉDAGOGIQUE</p><h2>Questions les plus fréquentes à l’assistant</h2></div>
                  <p>Questions et réponses enregistrées dans la base de données</p>
                </div>
                {frequentQuestions.length ? (
                  <div className="admin-frequent-list">
                    {frequentQuestions.map((item, index) => (
                      <article className="admin-frequent-item" key={`${item.question}-${index}`}>
                        <div className="admin-frequent-question">
                          <strong>{item.question}</strong>
                          <span>{item.count} demande{item.count === 1 ? '' : 's'} · Cours : {item.course}</span>
                        </div>
                        <p>{item.answer}</p>
                      </article>
                    ))}
                  </div>
                ) : <p className="admin-frequent-empty">Aucune question n’a encore été enregistrée. Les prochaines questions posées à l’assistant apparaîtront ici avec leur réponse.</p>}
              </section>
              {resources.filter((resource) => resource.pendingCount > 0).length === 0 && <div className="admin-empty-overview">Aucune demande d’approbation en attente.</div>}
            </section>
          ) : (
            <section className="admin-resource-page">
              <div className="admin-page-heading">
                <div><p className="admin-kicker">{translateAppLabel(selectedResource.appLabel)}</p><h1>{selectedResource.label}</h1></div>
                <div className="admin-heading-actions">
                  {(selectedResource.modelName === 'student' || selectedResource.modelName === 'teacher') && <label className="admin-pending-toggle"><input type="checkbox" checked={pendingOnly} onChange={(event) => { setPendingOnly(event.target.checked); setPage(1) }} /> En attente uniquement</label>}
                  {resourceData?.canAdd && <button className="admin-primary-button" onClick={() => openEditor()}>+ Ajouter</button>}
                </div>
              </div>
              <div className="admin-table-toolbar"><label className="admin-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Rechercher dans ce module…" /></label><span>{totalRecords} résultat{totalRecords === 1 ? '' : 's'}</span></div>
              <div className="admin-table-wrap">
                <table className="admin-data-table">
                  <thead><tr>{(resourceData?.columns || []).map((column) => <th key={column.name}>{column.label}</th>)}<th>Actions</th></tr></thead>
                  <tbody>
                    {records.map((record) => {
                      const isAccount = selectedResource.modelName === 'student' || selectedResource.modelName === 'teacher'
                      const isPending = isAccount && record.values.is_approved === false
                      return <tr key={record.id}>
                        {(resourceData?.columns || []).map((column) => <td key={column.name}>{displayValue(record.values[column.name])}</td>)}
                        <td className="admin-row-actions">
                          {selectedResource.modelName === 'learninggroup' && <button className="admin-text-button" onClick={() => { setGroupPanel({ id: record.id, name: record.values.name }); setGroupFilter('all_students'); setGroupCourseId('') }}>Gérer les membres</button>}
                          {isPending && <button className="admin-approve-button" onClick={() => approveRecord(record)}>Approuver</button>}
                          {resourceData?.canChange && <button className="admin-text-button" onClick={() => openEditor(record.id)}>Modifier</button>}
                          {resourceData?.canDelete && <button className="admin-delete-button" onClick={() => deleteRecord(record)}>Supprimer</button>}
                        </td>
                      </tr>
                    })}
                    {!pageLoading && records.length === 0 && <tr><td className="admin-empty-cell" colSpan={(resourceData?.columns.length || 0) + 1}>Aucun élément à afficher.</td></tr>}
                  </tbody>
                </table>
                {pageLoading && <div className="admin-table-loading">Chargement…</div>}
              </div>
              {groupPanel && selectedResource.modelName === 'learninggroup' && (
                <section className="admin-group-manager">
                  <header>
                    <div><p className="admin-kicker">GESTION DU GROUPE</p><h2>{groupPanel.name}</h2></div>
                    <button className="admin-cancel-button" type="button" onClick={() => setGroupPanel(null)}>Fermer</button>
                  </header>
                  <p>{groupMembers.length} membre(s) déjà ajouté(s). Seuls les administrateurs peuvent modifier les membres.</p>
                  <div className="admin-group-filters">
                    <label>Ajouter
                      <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                        <option value="all_students">Tous les apprenants actifs</option>
                        <option value="course_students">Apprenants inscrits à une formation</option>
                        <option value="teachers">Formateurs actifs</option>
                      </select>
                    </label>
                    {groupFilter === 'course_students' && <label>Cours
                      <select value={groupCourseId} onChange={(event) => setGroupCourseId(event.target.value)}>
                        <option value="">— Choisir une formation —</option>
                        {groupCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                      </select>
                    </label>}
                  </div>
                  <div className="admin-group-member-list">
                    {groupMembers.map((member) => <span key={member.id} className="admin-group-member-chip">{member.name} · {member.role}</span>)}
                  </div>
                  <div className="admin-group-candidates">
                    {groupLoading ? <p>Chargement des membres…</p> : groupCandidates.length ? groupCandidates.map((candidate) => (
                      <label key={candidate.id}>
                        <input type="checkbox" checked={selectedMemberIds.includes(candidate.id)} onChange={(event) => setSelectedMemberIds((current) => event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id))} />
                        <span>{candidate.name}<small>{candidate.email}</small></span>
                      </label>
                    )) : <p>Aucun membre disponible pour ce filtre.</p>}
                  </div>
                  <button className="admin-primary-button" type="button" disabled={groupLoading || !selectedMemberIds.length} onClick={addGroupMembers}>Ajouter les membres sélectionnés</button>
                </section>
              )}
              <footer className="admin-pagination"><button disabled={page <= 1 || pageLoading} onClick={() => setPage((current) => current - 1)}>Précédent</button><span>Page {page} · {Math.max(1, Math.ceil(totalRecords / (resourceData?.pageSize || 30)))}</span><button disabled={page >= Math.ceil(totalRecords / (resourceData?.pageSize || 30)) || pageLoading} onClick={() => setPage((current) => current + 1)}>Suivant</button></footer>
            </section>
          )}
        </div>
      </main>

      {editor && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null) }}>
          <section className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title">
            <header><div><p className="admin-kicker">{selectedResource.label}</p><h2 id="admin-editor-title">{editor.recordId ? 'Modifier' : 'Ajouter'}</h2></div><button onClick={() => setEditor(null)} aria-label="Fermer">×</button></header>
            <form onSubmit={saveRecord}>
              <div className="admin-form-fields">
                {editor.resource.fields.map((field) => {
                  if (isGroupAssignment && field.name === 'student') return null
                  const isAssignmentDetail = editor.resource.modelName === 'studentassignment' && field.name === 'detail'
                  return <label className={`admin-form-field ${field.type === 'textarea' ? 'is-wide' : ''}`} key={field.name}>
                  <span>{field.label}{field.required && !(editor.resource.modelName === 'studentassignment' && field.name === 'student' && isGroupAssignment) && <b> *</b>}</span>
                  {isAssignmentDetail ? <div className="assignment-rich-editor"><RichTextEditor value={formValues[field.name]} onChange={(value) => setFormValues((current) => ({ ...current, [field.name]: value }))} placeholder="Rédigez les consignes du devoir…" /></div>
                    : field.type === 'textarea' ? <textarea required={field.required} disabled={field.disabled} value={formValues[field.name] ?? ''} onChange={(event) => setFormValues({ ...formValues, [field.name]: event.target.value })} />
                    : field.type === 'select' || field.type === 'multiselect' ? <select required={field.required && !(editor.resource.modelName === 'studentassignment' && field.name === 'student' && isGroupAssignment)} disabled={field.disabled} multiple={field.type === 'multiselect'} value={formValues[field.name] ?? (field.type === 'multiselect' ? [] : '')} onChange={(event) => setFormValues((current) => {
                      const value = field.type === 'multiselect' ? Array.from(event.target.selectedOptions, (option) => option.value) : event.target.value
                      return {
                        ...current,
                        [field.name]: value,
                        ...(editor.resource.modelName === 'studentassignment' && field.name === 'group' && value ? { student: '' } : {}),
                      }
                    })}>{field.type !== 'multiselect' && <option value="">— Choisir —</option>}{field.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
                    : field.type === 'boolean' ? <input type="checkbox" disabled={field.disabled} checked={Boolean(formValues[field.name])} onChange={(event) => setFormValues({ ...formValues, [field.name]: event.target.checked })} />
                      : field.type === 'file' ? <input type="file" disabled={field.disabled} onChange={(event) => setFormFiles({ ...formFiles, [field.name]: event.target.files[0] || null })} />
                        : <input type={['date', 'datetime-local', 'email', 'number', 'password', 'time', 'url'].includes(field.type) ? field.type : 'text'} required={field.required} disabled={field.disabled} value={formValues[field.name] ?? ''} onChange={(event) => setFormValues({ ...formValues, [field.name]: event.target.value })} />}
                  {field.helpText && <small>{field.helpText}</small>}
                  </label>
                })}
                {isGroupAssignment && <p className="admin-form-hint is-wide">Chaque apprenant membre recevra un devoir individuel. Le choix d’un apprenant n’est donc pas nécessaire.</p>}
              </div>
              {formError && <div className="admin-alert" role="alert">{formError}</div>}
              <footer><button type="button" className="admin-cancel-button" onClick={() => setEditor(null)}>Annuler</button><button type="submit" className="admin-primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default AdminConsole
