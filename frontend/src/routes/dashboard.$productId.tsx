import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { env } from "@/env";
import { api } from "@/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

export const Route = createFileRoute("/dashboard/$productId")({
    component: RouteComponent,
});

type Product = {
    id: string;
    price: number;
    priceAt: string;
};

function RouteComponent(): ReactNode {
    const { productId } = Route.useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState<Product | null>(null);

    useEffect(() => {
        (async () => {
            const userId = localStorage.getItem("userId");
            if (!userId) {
                console.error("User ID not found");
                navigate({ to: "/" });
                return;
            }

            const response = await api.get(
                `${env.VITE_SERVER_URL}/products/${productId}`,
            );
            if (response.status !== 200) {
                console.error("Failed to fetch product data");
                navigate({ to: "/" });
                return;
            }
            const product = response.data;
            setProduct(product);
        })();
    }, [navigate, productId]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-200 to-white p-6 flex flex-col items-center gap-6">
            <h1 className="text-xl font-semibold text-center text-blue-900">
                PricePulse - E-Commerce Price Tracker
            </h1>

            <div className="flex w-full max-w-lg gap-2">
                <Input placeholder="Enter Amazon Product URL:" />
                <Button className="bg-green-500 hover:bg-green-600">
                    {product?.id}
                </Button>
            </div>

            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="text-md font-semibold">
                        Product Preview:
                    </CardTitle>
                </CardHeader>
            </Card>

            <Card className="w-full max-w-lg h-48">
                <CardHeader>
                    <CardTitle className="text-md font-semibold">
                        Price History Graph:
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center text-gray-400">
                    [Graph Placeholder]
                </CardContent>
            </Card>
        </div>
    );
}
