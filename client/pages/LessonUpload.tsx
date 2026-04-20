import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, FileText, Trash2, Edit2, Save, X } from "lucide-react";

interface LessonFile {
  id: string;
  name: string;
  title: string;
  uploadedAt: string;
  updatedAt?: string;
}

export default function LessonUpload() {
  const { user, hasRole } = useAuth();
  const [lessons, setLessons] = useState<LessonFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ title: "", file: null as File | null });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (!user?.id) {
      setLessons([]);
      return;
    }
    try {
      setLessons(JSON.parse(localStorage.getItem(`teacher_lessons_${user.id}`) || "[]"));
    } catch {
      setLessons([]);
    }
  }, [user?.id]);

  // If not teacher, show access denied
  if (!hasRole(["teacher", "admin"])) {
    return (
      <div className="container py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>You don't have permission to upload lessons. Teacher or Admin access required.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const nameOk = file && file.name.toLowerCase().endsWith(".pdf");
    const typeOk = file && (file.type === "application/pdf" || file.type === "");
    if (file && nameOk && typeOk) {
      setFormData((prev) => ({ ...prev, file }));
      setError("");
    } else {
      setError("Please select a valid PDF file");
      setFormData((prev) => ({ ...prev, file: null }));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("Please enter a lesson title");
      return;
    }
    if (!formData.file) {
      setError("Please select a PDF file");
      return;
    }
    if (!user?.id) {
      setError("You must be signed in to upload");
      return;
    }

    setIsUploading(true);
    try {
      // Simulate file upload (in production, upload to server)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const newLesson: LessonFile = {
        id: Date.now().toString(),
        name: formData.file.name,
        title: formData.title,
        uploadedAt: new Date().toISOString(),
      };

      const updatedLessons = [...lessons, newLesson];
      setLessons(updatedLessons);
      localStorage.setItem(`teacher_lessons_${user?.id}`, JSON.stringify(updatedLessons));

      setFormData({ title: "", file: null });
      setError("");
    } catch (err) {
      setError("Failed to upload lesson");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (lessonId: string) => {
    if (!window.confirm("Are you sure you want to delete this lesson?")) return;

    const updatedLessons = lessons.filter((l) => l.id !== lessonId);
    setLessons(updatedLessons);
    localStorage.setItem(`teacher_lessons_${user?.id}`, JSON.stringify(updatedLessons));
  };

  const startEditing = (lesson: LessonFile) => {
    setEditingId(lesson.id);
    setEditTitle(lesson.title);
  };

  const saveEdit = (lessonId: string) => {
    if (!editTitle.trim()) {
      setError("Lesson title cannot be empty");
      return;
    }

    const updatedLessons = lessons.map((l) =>
      l.id === lessonId
        ? { ...l, title: editTitle, updatedAt: new Date().toISOString() }
        : l
    );
    setLessons(updatedLessons);
    localStorage.setItem(`teacher_lessons_${user?.id}`, JSON.stringify(updatedLessons));
    setEditingId(null);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Upload Lessons</h1>
          <p className="text-white/60 mt-1">Share PDF lessons with students</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Upload New Lesson</CardTitle>
            <CardDescription className="text-white/60">
              Add a PDF lesson that students can access and download
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium text-white">
                  Lesson Title
                </label>
                <Input
                  id="title"
                  placeholder="Enter lesson title (e.g., Introduction to Algebra)"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="file" className="text-sm font-medium text-white">
                  PDF File
                </label>
                <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <input
                    id="file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <label htmlFor="file" className="cursor-pointer block">
                    <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-sm text-white font-medium">
                      {formData.file ? formData.file.name : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-white/60">PDF files only (max 10MB)</p>
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload Lesson"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Uploaded Lessons */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Your Lessons ({lessons.length})</h2>
          {lessons.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-white/60">
                No lessons uploaded yet. Create your first lesson above.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {lessons.map((lesson) => (
                <Card key={lesson.id} className="overflow-hidden">
                  <CardContent className="p-6 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="bg-primary/10 rounded-lg p-3 mt-1 shrink-0">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingId === lesson.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="text-white"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveEdit(lesson.id)}
                                className="flex-1"
                              >
                                <Save className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                                className="flex-1"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-semibold text-white">{lesson.title}</h3>
                            <p className="text-xs text-white/60 mt-1">{lesson.name}</p>
                            <p className="text-xs text-white/50 mt-2">
                              Uploaded {new Date(lesson.uploadedAt).toLocaleDateString()}
                              {lesson.updatedAt && ` • Updated ${new Date(lesson.updatedAt).toLocaleDateString()}`}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {editingId !== lesson.id && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(lesson)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(lesson.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
