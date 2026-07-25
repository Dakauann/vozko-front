export type PropertyType =
    | 'HOUSE'
    | 'APARTMENT'
    | 'COMMERCIAL'
    | 'LAND'
    | 'CONDO'
    | 'PENTHOUSE';

export type PropertyStatus =
    | 'AVAILABLE'
    | 'SOLD'
    | 'RENTED'
    | 'OFFER';

export type PropertyCondition =
    | 'NEW'
    | 'EXCELLENT'
    | 'GOOD'
    | 'FAIR'
    | 'NEEDS_REPAIR';

export type GeoLocation = {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    state?: string;
    zip_code?: string;
    neighborhood?: string;
};

export type PropertyAmenities = {
    has_pool?: boolean;
    has_garden?: boolean;
    has_garage?: boolean;
    has_ac?: boolean;
    has_fireplace?: boolean;
    has_security_system?: boolean;
    has_gym?: boolean;
    has_concierge?: boolean;
    has_balcony?: boolean;
    has_laundry?: boolean;
    has_patio?: boolean;
    has_elevator?: boolean;
    parking_spaces?: number;
    custom_amenities?: string[];
};

export type Category = {
    id: string;
    name: string;
    description?: string;
    parent_id?: string | null;
    created_at?: string;
    updated_at?: string;
};

export type Property = {
    id: string;
    shopId: number;
    name: string;
    description: string;
    type: PropertyType;
    status: PropertyStatus;
    condition?: PropertyCondition;
    location: GeoLocation;
    total_area: number;
    built_area?: number;
    lot_size?: number;
    suites?: number;
    bedrooms?: number;
    bathrooms?: number;
    floors?: number;
    living_rooms?: number;
    price: number;
    currency: string;
    price_per_sq_meter?: number;
    hoa_fees?: number;
    property_tax?: number;
    financing_available?: boolean;
    amenities: PropertyAmenities;
    year_built?: number;
    renovated_year?: number | null;
    construction_status?: string;
    registration_number?: string;
    ownership_type?: string;
    images: string[];
    virtual_tour_url?: string;
    category_id?: string;
    category?: Category | null;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    energy_rating?: string;
    is_solar?: boolean;
};

export type ListPropertiesParams = {
    page?: number;
    pageSize?: number;
    search?: string;
    q?: string;
    sortBy?: 'createdat' | 'updatedat' | 'name' | 'price' | 'totalarea' | 'bedrooms' | 'distance';
    sortOrder?: 'asc' | 'desc';
    latitude?: number;
    longitude?: number;
    type?: PropertyType;
    status?: PropertyStatus;
    condition?: PropertyCondition;
    city?: string;
    state?: string;
    neighborhood?: string;
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    minBathrooms?: number;
    minArea?: number;
    maxArea?: number;
    categoryId?: string;
    category?: string;
    createdFrom?: string;
    createdTo?: string;
};

export type PaginatedPropertiesResponse = {
    success: boolean;
    data: Property[];
    meta: {
        page: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    };
};

export type CreatePropertyPayload = {
    shopId: number;
    name: string;
    description?: string;
    type: PropertyType;
    status?: PropertyStatus;
    condition?: PropertyCondition;
    location: GeoLocation;
    total_area: number;
    built_area?: number;
    lot_size?: number;
    suites?: number;
    bedrooms?: number;
    bathrooms?: number;
    floors?: number;
    living_rooms?: number;
    price: number;
    currency?: string;
    hoa_fees?: number;
    property_tax?: number;
    financing_available?: boolean;
    amenities?: PropertyAmenities;
    year_built?: number;
    renovated_year?: number | null;
    construction_status?: string;
    registration_number?: string;
    ownership_type?: string;
    images?: string[];
    virtual_tour_url?: string;
    category_id?: string;
    energy_rating?: string;
    is_solar?: boolean;
};

export type UpdatePropertyPayload = Partial<CreatePropertyPayload>;

export type PropertyResponse = {
    success: boolean;
    data: Property;
};
