import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { env } from "@/env";
import { api } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type Product = {
    id: number;
    issuedById: number;
    name: string;
    amazonUrl: string;
};

export const Route = createFileRoute("/dashboard/")({
    component: RouteComponent,
});

function RouteComponent(): ReactNode {
    const [userId, setUserId] = useState<string | null>(null);
    const [amazonUrl, setAmazonUrl] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const storedUserId = localStorage.getItem("userId");
        setUserId(storedUserId);
    }, []);

    const {
        data: products,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["products", userId],
        queryFn: async () => {
            if (!userId) throw new Error("User ID not found");
            const response = await api.get(`${env.VITE_SERVER_URL}/products`, {
                params: { user_id: userId },
            });
            return response.data as Product[];
        },
        enabled: !!userId,
    });

    const handleSubmit = async () => {
        if (!amazonUrl) return;
        try {
            const response = await api.post(
                `${env.VITE_SERVER_URL}/track-product`,
                {
                    issued_by_id: userId,
                    product_url: amazonUrl,
                },
            );
            setAmazonUrl("");

            navigate({
                to: "/dashboard/$productId",
                params: { productId: response.data.id },
            });
        } catch (error) {
            console.error("Error adding product:", error);
        }
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Your Tracked Products</h1>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="flex items-center gap-2"
                        >
                            <PlusIcon className="h-5 w-5" /> Add Product
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4">
                        <div className="space-y-4">
                            <Input
                                placeholder="Amazon Product URL"
                                value={amazonUrl}
                                onChange={(e) => setAmazonUrl(e.target.value)}
                            />
                            <Button
                                variant="default"
                                className="w-full"
                                onClick={handleSubmit}
                                disabled={!amazonUrl}
                            >
                                Track
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                        <Card key={i} className="animate-pulse">
                            <CardHeader>
                                <CardTitle className="h-6 bg-gray-200 rounded w-1/2" />
                                <CardDescription className="h-4 bg-gray-200 rounded w-1/3 mt-2" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-32 bg-gray-200 rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : error ? (
                <div className="text-red-600">
                    Error loading products: {error.message}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products?.map((p) => (
                        <Card
                            key={p.id}
                            className="hover:shadow-lg transition-shadow"
                        >
                            <Link
                                to="/dashboard/$productId"
                                params={{ productId: p.id.toString() }}
                                className="block px-6 pt-4 pb-2"
                            >
                                <CardHeader className="p-0">
                                    <CardTitle className="text-xl">
                                        {p.name}
                                    </CardTitle>
                                </CardHeader>
                            </Link>
                            <CardContent className="px-6 pb-4">
                                <a
                                    href={p.amazonUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline text-sm"
                                >
                                    View on Amazon
                                </a>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
