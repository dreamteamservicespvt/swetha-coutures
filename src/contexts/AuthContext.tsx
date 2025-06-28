import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface UserData {
  uid: string;
  email: string;
  role: 'admin' | 'staff';
  name: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createAdminUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData({
              uid: user.uid,
              email: user.email!,
              role: data.role,
              name: data.name,
              phone: data.phone
            });
          } else {
            // If user doesn't exist in Firestore, create a default entry
            const defaultUserData = {
              role: user.email === 'swetha@gmail.com' ? 'admin' : 'staff',
              name: user.email === 'swetha@gmail.com' ? 'Swetha' : 'Staff Member'
            };
            
            await setDoc(doc(db, 'users', user.uid), defaultUserData);
            
            setUserData({
              uid: user.uid,
              email: user.email!,
              role: defaultUserData.role as 'admin' | 'staff',
              name: defaultUserData.name
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
      }
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const createAdminUser = async () => {
    try {
      // Create admin user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, 'swetha@gmail.com', 'swetha@gmail.com');
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        role: 'admin',
        name: 'Swetha'
      });

      toast({
        title: "Admin User Created",
        description: "Admin account has been successfully created",
      });
    } catch (error: any) {
      console.error('Error creating admin user:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast({
          title: "User Already Exists",
          description: "Admin user already exists in the system",
        });
      } else {
        toast({
          title: "Error Creating Admin",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Login Successful",
        description: "Welcome back to Swetha's Couture",
      });
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "See you soon!",
      });
    } catch (error: any) {
      toast({
        title: "Logout Failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const value = {
    user,
    userData,
    loading,
    login,
    logout,
    createAdminUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
