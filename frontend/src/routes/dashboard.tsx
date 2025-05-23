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
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/env";
import { api } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type Product = {
    id: string;
    price: number;
    priceAt: string;
};

export const Route = createFileRoute("/dashboard")({
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

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                    <Card key={index}>
                        <CardHeader>
                            <Skeleton className="h-6 w-1/2" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-3/4" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500">
                Error fetching products: {error.message}
            </div>
        );
    }

    const handleSubmit = async () => {
        if (!amazonUrl) return;
        try {
            const response = await api.post(
                `${env.VITE_SERVER_URL}/track-product`,
                {
                    issued_by_id: userId,
                    product_url: amazonUrl,
                    name: "lmao",
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
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Your Products</h1>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="mb-4">
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Add Product
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-4">
                    <div className="space-y-4">
                        <Input
                            placeholder="Enter Amazon Product URL"
                            value={amazonUrl}
                            onChange={(e) => setAmazonUrl(e.target.value)}
                        />
                        <Button
                            variant="default"
                            onClick={handleSubmit}
                            disabled={!amazonUrl}
                        >
                            Go to Product
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {products?.map((product) => (
                    <Card key={product.id}>
                        <CardHeader>
                            <CardTitle>{product.id}</CardTitle>
                            <CardDescription>₹{product.price}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>{product.price}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
