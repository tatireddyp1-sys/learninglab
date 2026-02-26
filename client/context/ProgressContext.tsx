import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface LessonProgress {
  lessonId: string;
  userId: string;
  progress: number; // 0-100
  completed: boolean;
  lastViewedAt: string;
  completedAt?: string;
}

interface ProgressContextType {
  getProgress: (userId: string, lessonId: string) => LessonProgress | null;
  setProgress: (userId: string, lessonId: string, progress: number) => void;
  markComplete: (userId: string, lessonId: string) => void;
  getUserProgress: (userId: string) => LessonProgress[];
  getProgressStats: (userId: string) => { completed: number; inProgress: number; notStarted: number };
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const getStorageKey = (userId: string) => `progress_${userId}`;

  const loadProgress = (userId: string): LessonProgress[] => {
    try {
      const key = getStorageKey(userId);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const saveProgress = (userId: string, progress: LessonProgress[]) => {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(progress));
  };

  const getProgress = (userId: string, lessonId: string): LessonProgress | null => {
    const progress = loadProgress(userId);
    return progress.find((p) => p.lessonId === lessonId) || null;
  };

  const setProgress = (userId: string, lessonId: string, progress: number) => {
    const allProgress = loadProgress(userId);
    const existingIndex = allProgress.findIndex((p) => p.lessonId === lessonId);

    if (existingIndex >= 0) {
      allProgress[existingIndex] = {
        ...allProgress[existingIndex],
        progress: Math.min(100, Math.max(0, progress)),
        lastViewedAt: new Date().toISOString(),
      };
    } else {
      allProgress.push({
        lessonId,
        userId,
        progress: Math.min(100, Math.max(0, progress)),
        completed: false,
        lastViewedAt: new Date().toISOString(),
      });
    }

    saveProgress(userId, allProgress);
  };

  const markComplete = (userId: string, lessonId: string) => {
    const allProgress = loadProgress(userId);
    const existingIndex = allProgress.findIndex((p) => p.lessonId === lessonId);

    if (existingIndex >= 0) {
      allProgress[existingIndex] = {
        ...allProgress[existingIndex],
        progress: 100,
        completed: true,
        completedAt: new Date().toISOString(),
        lastViewedAt: new Date().toISOString(),
      };
    } else {
      allProgress.push({
        lessonId,
        userId,
        progress: 100,
        completed: true,
        lastViewedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    }

    saveProgress(userId, allProgress);
  };

  const getUserProgress = (userId: string): LessonProgress[] => {
    const progress = loadProgress(userId);
    return progress.sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime());
  };

  const getProgressStats = (userId: string) => {
    const progress = loadProgress(userId);
    return {
      completed: progress.filter((p) => p.completed).length,
      inProgress: progress.filter((p) => !p.completed && p.progress > 0).length,
      notStarted: progress.filter((p) => p.progress === 0).length,
    };
  };

  return (
    <ProgressContext.Provider
      value={{
        getProgress,
        setProgress,
        markComplete,
        getUserProgress,
        getProgressStats,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
};
