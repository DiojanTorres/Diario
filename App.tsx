import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Button } from './components/Button';
import { storageService } from './services/storageService';
import { analyzeDiaryEntry } from './services/geminiService';
import { DiaryEntry, User } from './types';
import { Plus, Trash2, Calendar, ChevronLeft, Sparkles, AlertCircle, Book, Lock, Mail, Search, Save } from 'lucide-react';

// Robust UUID generator that works with Postgres UUID type
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator compliant with RFC 4122
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const MOOD_OPTIONS = [
  { label: 'Feliz', emoji: '😊' },
  { label: 'Calmado', emoji: '😌' },
  { label: 'Neutro', emoji: '😐' },
  { label: 'Enérgico', emoji: '⚡' },
  { label: 'Triste', emoji: '😔' },
];

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState(''); // Added Password State
  const [authName, setAuthName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // App State
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState(''); // Search State
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await storageService.getSession();
        if (session) {
          setUser(session);
          loadEntries(session.id); // Use ID instead of email for DB queries
        }
      } catch (error) {
        console.error("Session check failed", error);
      } finally {
        setAppLoading(false);
      }
    };
    initSession();
  }, []);

  const loadEntries = async (userId: string) => {
    try {
      const loadedEntries = await storageService.getEntries(userId);
      setEntries(loadedEntries);
    } catch (error) {
      console.error("Failed to load entries", error);
      // Optional: set global error state here
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    
    if (authPassword.length < 6) {
      setAuthError("La contraseña debe tener al menos 6 caracteres");
      setAuthLoading(false);
      return;
    }

    try {
      let loggedUser: User | null;
      if (isRegistering) {
        if (!authName.trim()) throw new Error("Por favor ingresa tu nombre");
        loggedUser = await storageService.register(authEmail, authName, authPassword);
      } else {
        loggedUser = await storageService.login(authEmail, authPassword);
        if (!loggedUser) throw new Error("Usuario no encontrado o credenciales incorrectas.");
      }
      setUser(loggedUser);
      if (loggedUser) loadEntries(loggedUser.id);
    } catch (err: any) {
      setAuthError(err.message || "Error de autenticación");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await storageService.logout();
    setUser(null);
    setEntries([]);
    setSelectedEntry(null);
    setIsEditing(false);
    setAuthPassword(''); // Clear password
    setSearchQuery('');
  };

  const handleCreateNew = () => {
    const newEntry: DiaryEntry = {
      id: generateId(),
      userId: user!.id, // Use ID
      title: '',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mood: 'Neutro' // Default mood
    };
    setSelectedEntry(newEntry);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedEntry || !user) return;
    if (!selectedEntry.title.trim() && !selectedEntry.content.trim()) return;

    setIsSaving(true);
    try {
      const saved = await storageService.saveEntry(selectedEntry);
      await loadEntries(user.id);
      setSelectedEntry(saved);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save", error);
      alert("Error al guardar: " + (error as Error).message + "\nRevisa la consola (F12) para más detalles.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault(); // Ensure button doesn't trigger other events
    
    if (!confirm("¿Estás seguro de querer eliminar esta entrada?")) return;
    
    // 1. Optimistic Update: Update UI immediately
    const previousEntries = [...entries];
    setEntries(current => current.filter(entry => entry.id !== id));

    try {
      // 2. Perform DB operation
      await storageService.deleteEntry(id);
      
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
        setIsEditing(false);
      }
      // No need to reload entries if optimistic update succeeded
    } catch (error) {
      console.error("Failed to delete", error);
      alert("No se pudo eliminar la entrada.");
      // 3. Rollback UI on error
      setEntries(previousEntries);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedEntry) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeDiaryEntry(selectedEntry.title, selectedEntry.content);
      const updatedEntry = {
        ...selectedEntry,
        aiReflection: analysis.reflection,
        mood: analysis.mood
      };
      setSelectedEntry(updatedEntry);
      // Auto save after analysis
      await storageService.saveEntry(updatedEntry);
      if (user) await loadEntries(user.id);
    } catch (err) {
      console.error(err);
      alert("Error al analizar con IA.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter Logic
  const filteredEntries = entries.filter(entry => {
    const query = searchQuery.toLowerCase();
    const title = (entry.title || '').toLowerCase();
    const content = (entry.content || '').toLowerCase();
    return title.includes(query) || content.includes(query);
  });

  // Views
  if (appLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-indigo-600">
        <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  // AUTHENTICATION VIEW
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          
          {/* Header Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-50 p-4 rounded-full">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isRegistering ? 'Crear Cuenta' : 'Bienvenido de nuevo'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isRegistering 
                ? 'Registra tus datos para comenzar tu viaje.' 
                : 'Ingresa tus credenciales para acceder a tu diario.'}
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-6 bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-3 text-red-600 text-sm animate-pulse">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {isRegistering && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre Completo</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-gray-800 placeholder-gray-400"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Correo Electrónico</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-gray-800 placeholder-gray-400"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="nombre@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-gray-800 placeholder-gray-400"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={authLoading}
              className={`w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform duration-200 ease-in-out ${authLoading ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
            >
              {authLoading ? (
                 <span className="flex items-center justify-center gap-2">
                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                 </span>
              ) : (
                isRegistering ? 'Registrarse' : 'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <p className="text-gray-500 text-sm">
              {isRegistering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}
              <button
                onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); setAuthPassword(''); }}
                className="ml-1 text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-all"
              >
                {isRegistering ? 'Inicia sesión' : 'Regístrate'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard View
  if (selectedEntry && isEditing) {
    return (
      <Layout user={user} onLogout={handleLogout}>
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8 min-h-[70vh]">
          
          {/* Top Bar: Back | Date | Save */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                   setIsEditing(false);
                   if (!selectedEntry.title && !selectedEntry.content) {
                     setSelectedEntry(null);
                   }
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                title="Volver"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-gray-500 font-medium">
                 <Calendar className="w-4 h-4" />
                 <span>
                    {new Date(selectedEntry.createdAt).toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                 </span>
              </div>
            </div>

            <Button onClick={handleSave} isLoading={isSaving} className="px-6 rounded-full bg-indigo-600 hover:bg-indigo-700">
              <Save className="w-4 h-4 mr-1" /> Guardar
            </Button>
          </div>

          {/* Mood Selector Chips */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-3">
              {MOOD_OPTIONS.map((option) => {
                const isSelected = selectedEntry.mood === option.label;
                return (
                  <button
                    key={option.label}
                    onClick={() => setSelectedEntry({...selectedEntry, mood: option.label})}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border
                      ${isSelected 
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500 shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                      }
                    `}
                  >
                    <span className="text-lg">{option.emoji}</span>
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title Input */}
          <input
            type="text"
            placeholder="Título..."
            className="w-full text-4xl font-bold text-gray-900 placeholder-gray-300 border-none focus:ring-0 px-0 mb-6 bg-transparent"
            value={selectedEntry.title}
            onChange={(e) => setSelectedEntry({ ...selectedEntry, title: e.target.value })}
            autoFocus
          />

          {/* Content Textarea */}
          <textarea
            placeholder="Escribe tus pensamientos aquí..."
            className="w-full h-[50vh] resize-none text-lg text-gray-700 placeholder-gray-300 border-none focus:ring-0 px-0 leading-relaxed bg-transparent"
            value={selectedEntry.content}
            onChange={(e) => setSelectedEntry({ ...selectedEntry, content: e.target.value })}
          />
        </div>
      </Layout>
    );
  }

  // Detail View (Read Mode)
  if (selectedEntry && !isEditing) {
    return (
      <Layout user={user} onLogout={handleLogout}>
        <div className="max-w-3xl mx-auto">
           <div className="mb-6 flex items-center justify-between">
            <button 
              onClick={() => setSelectedEntry(null)}
              className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" /> Volver a la lista
            </button>
            <div className="flex gap-2">
              {!selectedEntry.aiReflection && (
                <Button variant="secondary" onClick={handleAnalyze} isLoading={isAnalyzing} className="text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100">
                  <Sparkles className="w-4 h-4 text-indigo-500" /> Analizar con IA
                </Button>
              )}
              <Button onClick={() => setIsEditing(true)}>Editar</Button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedEntry.title || "Sin Título"}</h1>
              <div className="text-sm text-gray-500 mb-8 flex items-center gap-4">
                 <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(selectedEntry.createdAt).toLocaleDateString('es-ES')}</span>
                 {selectedEntry.mood && (
                   <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-semibold uppercase tracking-wide">
                     Ánimo: {selectedEntry.mood}
                   </span>
                 )}
              </div>
              <div className="prose prose-indigo max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selectedEntry.content}
              </div>
            </div>

            {selectedEntry.aiReflection && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 border-t border-indigo-100">
                <div className="flex items-start gap-3">
                  <div className="bg-white p-2 rounded-full shadow-sm mt-1">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-1">Reflexión de IA</h3>
                    <p className="text-indigo-800 italic">"{selectedEntry.aiReflection}"</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // List View
  return (
    <Layout user={user} onLogout={handleLogout}>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tu Diario</h1>
          <p className="text-gray-500 mt-1">Captura tus pensamientos, preserva tus memorias.</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-5 h-5" /> Nueva Entrada
        </Button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar entradas..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm text-gray-700 placeholder-gray-400"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Book className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Tu diario está vacío</h3>
          <p className="text-gray-500 mb-6">Empieza a escribir tu primera memoria hoy.</p>
          <Button variant="secondary" onClick={handleCreateNew}>Crear primera entrada</Button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-20">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No se encontraron entradas</h3>
          <p className="text-gray-500">Intenta con otros términos de búsqueda.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntries.map(entry => (
            <div 
              key={entry.id}
              onClick={() => setSelectedEntry(entry)}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col h-64"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                  {new Date(entry.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                </div>
                <button 
                  onClick={(e) => handleDelete(e, entry.id)}
                  className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                {entry.title || "Sin Título"}
              </h3>
              
              <p className="text-gray-600 line-clamp-4 flex-1 text-sm leading-relaxed">
                {entry.content || <span className="italic text-gray-400">Sin contenido...</span>}
              </p>

              {entry.mood && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-xs font-medium text-gray-500">{entry.mood}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default App;