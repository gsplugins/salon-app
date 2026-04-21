<?php

namespace App\Support;

final class SalonManagementContext
{
    /** Super admin: target shop for `/my/shop/*` when acting as salon manager. */
    public const ACT_AS_SHOP_SLUG_HEADER = 'X-Salon-Act-As-Shop-Slug';

    /** Shop owner / manager / super admin: which `salon_staff` row `/api/staff/*` should operate as. */
    public const ACT_AS_STAFF_ID_HEADER = 'X-Act-As-Staff-Id';
}
