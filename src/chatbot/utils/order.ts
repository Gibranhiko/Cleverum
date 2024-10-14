interface OrderItem {
    producto: string;
    cantidad?: number;
    peso?: string;
}

function validateOrder(order: OrderItem[], validProducts: { product: string; type: string }[]): string | boolean {
    if (!Array.isArray(order) || order.length === 0) {
        return false;
    }

    if (order[0].producto === 'undefined') {
        return false;
    }

    for (const item of order) {
        // Encuentra el producto en el objeto validProducts
        const validProduct = validProducts.find(p => p.product.toLowerCase() === item.producto.toLowerCase());

        if (!validProduct) {
            return false;
        }

        // Valida si el tipo es cantidad o peso
        if (validProduct.type === "qty" && typeof item.cantidad !== 'number') {
            return 'missing-quantity';
        } else if (validProduct.type === "weight" && typeof item.peso !== 'string') {
            return 'missing-weight';
        }
    }

    return true;
}


export { OrderItem, validateOrder };