import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { env } from "@/env";
import { api } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { AxiosError } from "axios";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const Route = createFileRoute("/login")({
    component: RouteComponent,
});

const formSchema = z.object({
    email: z.string().email(),
    password: z
        .string()
        .min(8)
        .regex(/[A-Za-z0-9]*/),
});

type FormSchema = z.infer<typeof formSchema>;
type Response = {
    message: string;
    userId: number;
};
type ErrorResponse = {
    message: string;
};

function RouteComponent(): ReactNode {
    const form = useForm<FormSchema>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });
    const [error, setError] = useState<string>("");
    const navigate = useNavigate();
    const mutation = useMutation({
        mutationFn: async (data: FormSchema): Promise<Response> => {
            const response = await api.post(
                `${env.VITE_SERVER_URL}/signin`,
                data,
            );
            return response.data as Response;
        },
        onSuccess: (data) => {
            if (localStorage)
                localStorage.setItem("userId", data.userId.toString());
            navigate({ to: "/dashboard" });
        },
        onError: (error: AxiosError<ErrorResponse>): void => {
            if (error.response?.data) {
                setError(error.response.data.message);
            } else {
                setError("An unexpected error occurred.");
            }
        },
    });
    const onSubmit = async (data: FormSchema): Promise<void> => {
        mutation.mutate(data);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter your email"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter your password"
                                            type="password"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button
                            type="submit"
                            disabled={mutation.isPending}
                            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
                        >
                            Submit
                        </Button>
                    </form>
                </Form>
                {error && (
                    <div className="mt-4 text-red-600">
                        <p>{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
