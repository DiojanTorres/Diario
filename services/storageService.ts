import { DiaryEntry, User } from '../types';
import { supabase } from './supabaseClient';

export const storageService = {
  // Auth
  async login(email: string, password?: string): Promise<User | null> {
    if (!password) throw new Error("Se requiere contraseña");
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) return null;

    return {
      id: data.user.id,
      email: data.user.email!,
      name: data.user.user_metadata?.name || email.split('@')[0],
    };
  },

  async register(email: string, name: string, password?: string): Promise<User> {
    if (!password) throw new Error("Se requiere contraseña");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Error al crear usuario");

    return {
      id: data.user.id,
      email: data.user.email!,
      name: name,
    };
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getSession(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) return null;

    return {
      id: session.user.id,
      email: session.user.email!,
      name: session.user.user_metadata?.name || session.user.email!.split('@')[0],
    };
  },

  // Entries
  async getEntries(userId: string): Promise<DiaryEntry[]> {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
      throw new Error(error.message);
    }

    // Map DB columns (snake_case) to App types (camelCase)
    // Robustly handle created_at whether it's BigInt or ISO String
    return (data || []).map((item: any) => {
      let createdAt = Number(item.created_at);
      if (isNaN(createdAt)) {
        // If Number conversion fails, it might be an ISO string (timestamptz)
        createdAt = new Date(item.created_at).getTime();
      }

      let updatedAt = Number(item.updated_at);
      if (isNaN(updatedAt)) {
         updatedAt = new Date(item.updated_at).getTime();
      }

      return {
        id: item.id,
        userId: item.user_id,
        title: item.title || "",
        content: item.content || "",
        createdAt: createdAt || Date.now(),
        updatedAt: updatedAt || Date.now(),
        mood: item.mood,
        aiReflection: item.ai_reflection
      };
    });
  },

  async saveEntry(entry: DiaryEntry): Promise<DiaryEntry> {
    // Map App types to DB columns
    // Use nullish coalescing to ensure we send null, not undefined
    const dbEntry = {
      id: entry.id,
      user_id: entry.userId,
      title: entry.title || "",
      content: entry.content || "",
      created_at: entry.createdAt, // Assumes BigInt column per instructions. 
      updated_at: Date.now(),
      mood: entry.mood || null,
      ai_reflection: entry.aiReflection || null
    };

    console.log("Intentando guardar en Supabase:", dbEntry);

    const { data, error } = await supabase
      .from('entries')
      .upsert(dbEntry)
      .select()
      .single();

    if (error) {
      console.error('Error de Supabase al guardar:', error);
      throw new Error(`Error BD: ${error.message} (${error.code})`);
    }

    // Return the entry with updated timestamp from DB (mapped safely)
    let updatedAt = Number(data.updated_at);
    if (isNaN(updatedAt)) updatedAt = Date.now();

    return {
      ...entry,
      updatedAt: updatedAt
    };
  },

  async deleteEntry(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', entryId);

    if (error) throw new Error(error.message);
  }
};