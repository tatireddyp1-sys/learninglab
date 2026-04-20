import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseFormSchema } from "@/lib/validators";
import { z } from "zod";
import { useLms } from "@/context/LmsContext";
import { useAuth } from "@/context/AuthContext";
import { ForbiddenState } from "@/components/PageState";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";

const schema = courseFormSchema;
type FormValues = z.infer<typeof schema>;

export default function CourseCreatePage() {
  const { user } = useAuth();
  const { canCreateCourse } = usePermissions();
  const { createCourse } = useLms();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "" },
  });

  if (!user || !canCreateCourse()) {
    return <ForbiddenState message="You cannot create courses with your current role." />;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create course</h1>
        <p className="text-sm text-muted-foreground">Title and description are validated before save.</p>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            try {
              const c = await createCourse({ title: values.title, description: values.description ?? "" });
              toast({ title: "Course created" });
              navigate(`/courses/${c.id}`);
            } catch (err: any) {
              toast({ title: "Create failed", description: err.message, variant: "destructive" });
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
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Create
          </Button>
        </form>
      </Form>
    </div>
  );
}
