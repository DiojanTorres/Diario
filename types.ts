export interface User {
  id: string;
  email: string;
  name: string;
}

export interface DiaryEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  aiReflection?: string; // Optional AI analysis
  mood?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export type ViewState = 'list' | 'create' | 'edit';