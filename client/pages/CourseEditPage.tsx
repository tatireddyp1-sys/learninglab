import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseFormSchema } from "@/lib/validators";
import { z } from "zod";
import { useLms } from "@/context/LmsContext";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { EmptyState } from "@/components/PageState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserMinus, UserPlus } from "lucide-react";

const schema = courseFormSchema;
type FormValues = z.infer<typeof schema>;

export default function CourseEditPage() {
  const { courseId } = useParams();
  const { user, listUsers } = useAuth();
  const { canEditCourse } = usePermissions();
  const { getCourse, updateCourse, checkStaleCourse, assignTeacher, removeTeacher } = useLms();
  const navigate = useNavigate();
  const { toast } = useToast();
  const course = courseId ? getCourse(courseId) : undefined;
  const [baseline, setBaseline] = useState(course?.updatedAt);
  const [directory, setDirectory] = useState<{ id: string; name: string }[]>([]);
  const [addTeacherId, setAddTeacherId] = useState("");
  const [teacherBusy, setTeacherBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listUsers();
        setDirectory(rows.map((u) => ({ id: u.id, name: u.name })));
      } catch {
        setDirectory([]);
      }
    })();
  }, [listUsers]);

  const teacherIds = useMemo(() => {
    if (!course) return [];
    if (course.teacherIds?.length) return course.teacherIds;
    return course.createdBy ? [course.createdBy] : [];
  }, [course]);

  const addTeacherCandidates = useMemo(() => {
    return directory.filter((u) => !teacherIds.includes(u.id));
  }, [directory, teacherIds]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: course?.title ?? "", description: course?.description ?? "" },
  });

  useEffect(() => {
    if (course) {
      form.reset({ title: course.title, description: course.description });
      setBaseline(course.updatedAt);
    }
  }, [course, form]);

  if (!courseId || !course) {
    return <EmptyState title="Course not found" />;
  }

  if (!user || !canEditCourse(course)) {
    return <EmptyState title="Access denied" description="You cannot edit this course." />;
  }

  const stale = baseline && checkStaleCourse(course.id, baseline);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit course</h1>
        <p className="text-sm text-muted-foreground">Title and description sync to the courses API when configured.</p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-medium">Co-instructors</h2>
          <p className="text-xs text-muted-foreground">
            Assign teachers who can edit lessons and manage enrollments for this course. At least one instructor must remain.
          </p>
        </div>
        <ul className="space-y-2">
          {teacherIds.map((tid) => (
            <li key={tid} className="flex items-center justify-between gap-2 text-sm rounded-md border px-3 py-2">
              <span>{directory.find((d) => d.id === tid)?.name ?? tid}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={teacherBusy || teacherIds.length <= 1}
                onClick={async () => {
                  if (!courseId) return;
                  setTeacherBusy(true);
                  try {
                    await removeTeacher(courseId, tid);
                    toast({ title: "Instructor removed" });
                  } catch (err: unknown) {
                    toast({
                      title: "Remove failed",
                      description: err instanceof Error ? err.message : String(err),
                      variant: "destructive",
                    });
                  } finally {
                    setTeacherBusy(false);
                  }
                }}
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs">Add instructor</Label>
            <Select value={addTeacherId || undefined} onValueChange={setAddTeacherId} disabled={addTeacherCandidates.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={addTeacherCandidates.length === 0 ? "No users available" : "Choose user"} />
              </SelectTrigger>
              <SelectContent>
                {addTeacherCandidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={!addTeacherId || teacherBusy}
            onClick={async () => {
              if (!courseId || !addTeacherId) return;
              setTeacherBusy(true);
              try {
                await assignTeacher(courseId, addTeacherId);
                toast({ title: "Instructor assigned" });
                setAddTeacherId("");
              } catch (err: unknown) {
                toast({
                  title: "Assign failed",
                  description: err instanceof Error ? err.message : String(err),
                  variant: "destructive",
                });
              } finally {
                setTeacherBusy(false);
              }
            }}
          >
            {teacherBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
            Add
          </Button>
        </div>
      </div>
      {stale && (
        <Alert variant="destructive">
          <AlertTitle>Concurrent edit</AlertTitle>
          <AlertDescription>
            This course was updated elsewhere. Refresh the page before continuing or you may overwrite changes.
          </AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            if (baseline && checkStaleCourse(course.id, baseline)) {
              return;
            }
            try {
              await updateCourse(course.id, { title: values.title, description: values.description ?? "" });
              toast({ title: "Course updated" });
              navigate(`/courses/${course.id}`);
            } catch (err: any) {
              toast({ title: "Save failed", description: err.message, variant: "destructive" });
            }
          })}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={200} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={5} maxLength={2000} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={form.formState.isSubmitting || !!stale}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/courses/${course.id}`)}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
