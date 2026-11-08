import bcrypt from 'bcryptjs';
import { SRI_LANKA_DISTRICTS } from '../config/sriLankaDistricts.js';

export function getInitialSeedState() {
  const adminHash = bcrypt.hashSync('Admin@123', 8);
  const sellerHash = bcrypt.hashSync('Seller@123', 8);
  const customerHash = bcrypt.hashSync('Customer@123', 8);

  const users = [
    {
      _id: 'usr_admin_1',
      name: 'Yaans.lk Marketplace Admin',
      email: 'admin@yaans.lk',
      phone: '0771002000',
      passwordHash: adminHash,
      role: 'admin',
      sellerId: null,
      defaultDistrict: 'Colombo',
      addresses: [],
      wishlist: [],
      isActive: true,
      createdAt: '2026-09-01T08:00:00.000Z'
    },
    {
      _id: 'usr_seller_1',
      name: 'Kumari Dissanayake',
      email: 'kumari@kandykitchen.lk',
      phone: '0714558899',
      passwordHash: sellerHash,
      role: 'seller',
      sellerId: 'sel_kandy_1',
      defaultDistrict: 'Kandy',
      addresses: [],
      wishlist: [],
      isActive: true,
      createdAt: '2026-09-05T09:00:00.000Z'
    },
    {
      _id: 'usr_seller_2',
      name: 'Rizwan Farook',
      email: 'rizwan@colombotech.lk',
      phone: '0772334455',
      passwordHash: sellerHash,
      role: 'seller',
      sellerId: 'sel_colombo_2',
      defaultDistrict: 'Colombo',
      addresses: [],
      wishlist: [],
      isActive: true,
      createdAt: '2026-09-06T10:00:00.000Z'
    },
    {
      _id: 'usr_seller_3',
      name: 'Nirosha Mendis',
      email: 'nirosha@ruhunuhandloom.lk',
      phone: '0769887766',
      passwordHash: sellerHash,
      role: 'seller',
      sellerId: 'sel_galle_3',
      defaultDistrict: 'Galle',
      addresses: [],
      wishlist: [],
      isActive: true,
      createdAt: '2026-09-08T11:00:00.000Z'
    },
    {
      _id: 'usr_seller_4',
      name: 'Tharindu Jayasuriya',
      email: 'tharindu@ceylonherbs.lk',
      phone: '0705112233',
      passwordHash: sellerHash,
      role: 'seller',
      sellerId: 'sel_gampaha_4',
      defaultDistrict: 'Gampaha',
      addresses: [],
      wishlist: [],
      isActive: true,
      createdAt: '2026-09-10T11:00:00.000Z'
    },
    {
      _id: 'usr_seller_5',
      name: 'Suresh Nadarajah',
      email: 'suresh@jaffnapalm.lk',
      phone: '0778901234',
      passwordHash: sellerHash,
      role: 'seller',
      sellerId: 'sel_jaffna_5',
      defaultDistrict: 'Jaffna',
      addresses: [],
      wishlist: [],
      isActive: true,
      createdAt: '2026-11-01T14:00:00.000Z'
    },
    {
      _id: 'usr_cust_1',
      name: 'Kasun Perera',
      email: 'kasun@gmail.com',
      phone: '0774123987',
      passwordHash: customerHash,
      role: 'customer',
      sellerId: null,
      defaultDistrict: 'Colombo',
      addresses: [
        {
          _id: 'addr_1',
          label: 'Home (Colombo 05)',
          recipientName: 'Kasun Perera',
          phone: '0774123987',
          addressLine1: 'No. 42/B, Fife Road, Thimbirigasyaya',
          addressLine2: 'Near Isipathana Mawatha',
          city: 'Colombo 05',
          district: 'Colombo',
          postalCode: '00500',
          isDefault: true
        },
        {
          _id: 'addr_2',
          label: 'Parents Home (Kandy)',
          recipientName: 'Sunil Perera',
          phone: '0718234567',
          addressLine1: 'No. 18, Peradeniya Road',
          addressLine2: 'Mulgampola',
          city: 'Kandy',
          district: 'Kandy',
          postalCode: '20000',
          isDefault: false
        }
      ],
      wishlist: ['prd_1', 'prd_5', 'prd_9'],
      isActive: true,
      createdAt: '2026-09-15T12:00:00.000Z'
    }
  ];

  const sellers = [
    {
      _id: 'sel_kandy_1',
      userId: 'usr_seller_1',
      storeName: 'Kandy Spice & Homemade Pantry',
      slug: 'kandy-spice-homemade-pantry',
      sellerType: 'Homemade & Cottage',
      isHomemadeVendor: true,
      description:
        'Authentic Kandyan home-prepared spices, Malay achcharu, pure Kithul treacle, and crispy Ambarella & Jackfruit snacks made fresh in small batches without artificial preservatives.',
      logoUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=300&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
      contactPhone: '0714558899',
      contactEmail: 'kumari@kandykitchen.lk',
      district: 'Kandy',
      city: 'Katugastota, Kandy',
      businessAddress: 'No. 114, Madawala Road, Katugastota, Kandy',
      nicOrBrNumber: '198462304112',
      status: 'approved',
      rejectionReason: '',
      commissionRateOverride: 5,
      shippingPolicy: {
        freeShippingThresholdLkr: 3500,
        flatRateIntraLkr: 260,
        dispatchTimeDays: '1-2 business days'
      },
      bankDetails: {
        bankName: 'Sampath Bank',
        branchName: 'Kandy City Branch',
        accountHolderName: 'D.M. Kumari Dissanayake',
        accountNumber: '102944819201'
      },
      rating: 4.9,
      reviewCount: 142,
      totalSalesCount: 486,
      createdAt: '2026-09-05T09:00:00.000Z'
    },
    {
      _id: 'sel_colombo_2',
      userId: 'usr_seller_2',
      storeName: 'Colombo Tech Hub',
      slug: 'colombo-tech-hub',
      sellerType: 'Verified Retail Vendor',
      isHomemadeVendor: false,
      description:
        'Islandwide distributor of genuine consumer electronics, wireless audio, power banks, smartwatches, and work-from-home computer accessories backed by seller warranty.',
      logoUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
      contactPhone: '0772334455',
      contactEmail: 'rizwan@colombotech.lk',
      district: 'Colombo',
      city: 'Bambalapitiya, Colombo 04',
      businessAddress: 'Unit 204, Galle Road, Bambalapitiya, Colombo 04',
      nicOrBrNumber: 'PV-0094812',
      status: 'approved',
      rejectionReason: '',
      commissionRateOverride: null,
      shippingPolicy: {
        freeShippingThresholdLkr: 8500,
        flatRateIntraLkr: 280,
        dispatchTimeDays: 'Same day / Next day'
      },
      bankDetails: {
        bankName: 'Commercial Bank of Ceylon',
        branchName: 'Bambalapitiya',
        accountHolderName: 'Colombo Tech Hub (Pvt) Ltd',
        accountNumber: '8004519920'
      },
      rating: 4.8,
      reviewCount: 218,
      totalSalesCount: 790,
      createdAt: '2026-09-06T10:00:00.000Z'
    },
    {
      _id: 'sel_galle_3',
      userId: 'usr_seller_3',
      storeName: 'Ruhunu Clay & Handloom Co.',
      slug: 'ruhunu-clay-handloom',
      sellerType: 'Artisan & Craft',
      isHomemadeVendor: true,
      description:
        'Direct from Southern Sri Lankan artisans: seasoned terracotta clay curry pots (walan), handwoven Dumbara & Galle cotton linen, coconut-shell tableware, and brass oil lamps.',
      logoUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=300&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1200&q=80',
      contactPhone: '0769887766',
      contactEmail: 'nirosha@ruhunuhandloom.lk',
      district: 'Galle',
      city: 'Karapitiya, Galle',
      businessAddress: 'No. 55, Wakwella Road, Galle',
      nicOrBrNumber: '198974102331',
      status: 'approved',
      rejectionReason: '',
      commissionRateOverride: 6,
      shippingPolicy: {
        freeShippingThresholdLkr: 5000,
        flatRateIntraLkr: 300,
        dispatchTimeDays: '1-2 business days'
      },
      bankDetails: {
        bankName: 'Hatton National Bank (HNB)',
        branchName: 'Galle',
        accountHolderName: 'Ruhunu Clay & Handloom Enterprise',
        accountNumber: '014020394811'
      },
      rating: 4.9,
      reviewCount: 96,
      totalSalesCount: 315,
      createdAt: '2026-09-08T11:00:00.000Z'
    },
    {
      _id: 'sel_gampaha_4',
      userId: 'usr_seller_4',
      storeName: 'OsuLanka Herbal & Wellness',
      slug: 'osulanka-herbal-wellness',
      sellerType: 'Small Business',
      isHomemadeVendor: true,
      description:
        'Natural Sri Lankan Ayurvedic hair oils, King Coconut & Sandalwood skincare, virgin coconut oil, and herbal teas crafted in Gampaha.',
      logoUrl: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?auto=format&fit=crop&w=300&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?auto=format&fit=crop&w=1200&q=80',
      contactPhone: '0705112233',
      contactEmail: 'tharindu@ceylonherbs.lk',
      district: 'Gampaha',
      city: 'Kadawatha, Gampaha',
      businessAddress: 'No. 89, Kandy Road, Kadawatha',
      nicOrBrNumber: 'WC-44109',
      status: 'approved',
      rejectionReason: '',
      commissionRateOverride: 7,
      shippingPolicy: {
        freeShippingThresholdLkr: 4000,
        flatRateIntraLkr: 280,
        dispatchTimeDays: '1-2 business days'
      },
      bankDetails: {
        bankName: 'Bank of Ceylon (BOC)',
        branchName: 'Gampaha Super Grade',
        accountHolderName: 'OsuLanka Wellness',
        accountNumber: '74920188'
      },
      rating: 4.7,
      reviewCount: 74,
      totalSalesCount: 240,
      createdAt: '2026-09-10T11:00:00.000Z'
    },
    {
      _id: 'sel_jaffna_5',
      userId: 'usr_seller_5',
      storeName: 'Jaffna Palmyrah & Organic Foods',
      slug: 'jaffna-palmyrah-organic',
      sellerType: 'Homemade & Cottage',
      isHomemadeVendor: true,
      description:
        'Traditional Northern Jaffna roasted curry powder, Odial flour, Palmyrah jaggery (hakuru), and handwoven palmyrah leaf baskets.',
      logoUrl: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=300&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=1200&q=80',
      contactPhone: '0778901234',
      contactEmail: 'suresh@jaffnapalm.lk',
      district: 'Jaffna',
      city: 'Nallur, Jaffna',
      businessAddress: 'No. 22, Point Pedro Road, Nallur, Jaffna',
      nicOrBrNumber: '199124508819',
      status: 'pending',
      rejectionReason: '',
      commissionRateOverride: 5,
      shippingPolicy: {
        freeShippingThresholdLkr: 4500,
        flatRateIntraLkr: 300,
        dispatchTimeDays: '2-3 business days'
      },
      bankDetails: {
        bankName: 'Peoples Bank',
        branchName: 'Jaffna Town',
        accountHolderName: 'S. Nadarajah',
        accountNumber: '045200198834'
      },
      rating: 5.0,
      reviewCount: 0,
      totalSalesCount: 0,
      createdAt: '2026-11-01T14:00:00.000Z'
    }
  ];

  // Categories structured with 2x2 Quad Tiles modeled on the mobile reference image
  const categories = [
    {
      _id: 'cat_1',
      name: 'Homemade & Spices',
      slug: 'homemade-pantry',
      quadHeadline: 'Sri Lankan Homemade & Pantry',
      description: 'Home-cooked achcharu, roasted Ceylon spices, pure kithul treacle, and traditional snacks.',
      imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
      displayOrder: 1,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Ceylon Spices',
          slug: 'ceylon-spices',
          imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Achcharu & Sambol',
          slug: 'achcharu-sambol',
          imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Kithul & Honey',
          slug: 'kithul-honey',
          imageUrl: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Traditional Sweets',
          slug: 'traditional-sweets',
          imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        }
      ]
    },
    {
      _id: 'cat_2',
      name: 'Electronics & Tech',
      slug: 'electronics',
      quadHeadline: 'Plug in with Electronics',
      description: 'Headphones, tablets, speakers, power banks, and PC accessories from verified Colombo sellers.',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
      displayOrder: 2,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Headphones',
          slug: 'headphones-audio',
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Smartwatches',
          slug: 'smartwatches',
          imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Bluetooth Speakers',
          slug: 'speakers',
          imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'PC Accessories',
          slug: 'pc-accessories',
          imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        }
      ]
    },
    {
      _id: 'cat_3',
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
      quadHeadline: 'Fantastic Finds for Home',
      description: 'Seasoned clay cookware, coconut wood utensils, kitchen appliances, and Sri Lankan home decor.',
      imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
      displayOrder: 3,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Clay Cookware',
          slug: 'clay-cookware',
          imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Kitchen & Dining',
          slug: 'kitchen-dining',
          imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Home Decor',
          slug: 'home-decor',
          imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Storage & Craft',
          slug: 'storage-craft',
          imageUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        }
      ]
    },
    {
      _id: 'cat_4',
      name: 'Fashion & Handloom',
      slug: 'fashion-handloom',
      quadHeadline: 'Apparel & Handloom Favorites',
      description: 'Breathable tropical cotton wear, authentic Sri Lankan batik, handloom sarongs, and everyday fashion.',
      imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80',
      displayOrder: 4,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Women Linen & Batik',
          slug: 'womens-wear',
          imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Men Casual & Sarongs',
          slug: 'mens-wear',
          imageUrl: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Handbags & Totes',
          slug: 'bags-totes',
          imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Kids & Baby',
          slug: 'kids-baby',
          imageUrl: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        }
      ]
    },
    {
      _id: 'cat_5',
      name: 'Ayurveda & Beauty',
      slug: 'ayurveda-beauty',
      quadHeadline: 'Unveil Your Radiance',
      description: 'Pure Ceylon herbal hair oils, sandalwood & turmeric skincare, and natural wellness essentials.',
      imageUrl: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?auto=format&fit=crop&w=600&q=80',
      displayOrder: 5,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Herbal Hair Care',
          slug: 'hair-care',
          imageUrl: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Natural Skincare',
          slug: 'skincare',
          imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Essential Oils',
          slug: 'essential-oils',
          imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Herbal Teas',
          slug: 'herbal-teas',
          imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        }
      ]
    },
    {
      _id: 'cat_6',
      name: 'Fitness & Everyday Gear',
      slug: 'fitness-daily-deals',
      quadHeadline: 'Gear Up & Value Deals',
      description: 'Home fitness gear, insulated flasks, bags, and practical daily essentials under Rs. 2,500.',
      imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80',
      displayOrder: 6,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Fitness Equipment',
          slug: 'fitness-equipment',
          imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Flasks & Bottles',
          slug: 'flasks-bottles',
          imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Backpacks & Gear',
          slug: 'backpacks-gear',
          imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Under Rs. 1,500',
          slug: 'under-1500',
          imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        }
      ]
    }
  ];

  const products = [
    {
      _id: 'prd_1',
      sellerId: 'sel_kandy_1',
      sellerName: 'Kandy Spice & Homemade Pantry',
      sellerSlug: 'kandy-spice-homemade-pantry',
      sellerDistrict: 'Kandy',
      sellerType: 'Homemade & Cottage',
      title: 'Homemade Kandyan Malay Achcharu (Glass Jar - Traditional Recipe)',
      slug: 'homemade-kandyan-malay-achcharu-jar',
      sku: 'KSP-ACH-001',
      categorySlug: 'homemade-pantry',
      subCategorySlug: 'achcharu-sambol',
      description:
        'Prepared fresh in small home batches in Katugastota, Kandy using crisp red shallots, green chilies, dates, carrot, pineapple, and stone-ground mustard-vinegar spice paste. Zero artificial preservatives or colors. Perfect side for rice & curry, biriyani, or yellow rice.',
      highlights: [
        '100% Homemade in Kandy by Kumari Kitchen',
        'Sealed hygienic glass jar with 6-month shelf life',
        'No MSG, artificial preservatives, or synthetic vinegar',
        'Cash on Delivery (COD) available across all 25 districts'
      ],
      priceLkr: 1150,
      compareAtPriceLkr: 1390,
      stock: 45,
      images: [
        'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Jar Weight',
          values: [
            { label: '375g Glass Jar', priceLkr: 1150, stock: 45 },
            { label: '750g Family Jar', priceLkr: 2100, stock: 20 }
          ]
        }
      ],
      isHomemade: true,
      isFeatured: true,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.9,
      reviewCount: 48,
      soldCount: 185,
      tags: ['homemade', 'achcharu', 'kandy', 'pickle', 'sri lankan food'],
      createdAt: '2026-09-12T10:00:00.000Z'
    },
    {
      _id: 'prd_2',
      sellerId: 'sel_kandy_1',
      sellerName: 'Kandy Spice & Homemade Pantry',
      sellerSlug: 'kandy-spice-homemade-pantry',
      sellerDistrict: 'Kandy',
      sellerType: 'Homemade & Cottage',
      title: 'Pure Kotmale Kithul Treacle (100% Unadulterated Pani - 375ml Bottle)',
      slug: 'pure-kotmale-kithul-treacle-375ml',
      sku: 'KSP-KTH-002',
      categorySlug: 'homemade-pantry',
      subCategorySlug: 'kithul-honey',
      description:
        'Sourced directly from traditional Kithul tappers in the Kotmale & Knuckles foothills and slow-boiled over firewood. Rich aroma, thick golden-brown consistency, ideal for buffalo curd (mee kiri), hoppers, kavum, and healthy sweetening.',
      highlights: [
        'Single-origin Kotmale village Kithul sap – no added sugar syrup',
        'Wood-fired in traditional copper cauldron',
        'Packed in tamper-sealed glass bottle with protective bubble wrap'
      ],
      priceLkr: 1650,
      compareAtPriceLkr: 1950,
      stock: 32,
      images: [
        'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Bottle Volume',
          values: [
            { label: '375ml Bottle', priceLkr: 1650, stock: 32 },
            { label: '750ml Bottle', priceLkr: 3100, stock: 14 }
          ]
        }
      ],
      isHomemade: true,
      isFeatured: true,
      isDeal: false,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.9,
      reviewCount: 61,
      soldCount: 210,
      tags: ['kithul', 'treacle', 'pani', 'homemade', 'organic'],
      createdAt: '2026-09-14T10:00:00.000Z'
    },
    {
      _id: 'prd_3',
      sellerId: 'sel_kandy_1',
      sellerName: 'Kandy Spice & Homemade Pantry',
      sellerSlug: 'kandy-spice-homemade-pantry',
      sellerDistrict: 'Kandy',
      sellerType: 'Homemade & Cottage',
      title: 'Home-Roasted Dark Ceylon Curry Powder & Alba Cinnamon Value Pack',
      slug: 'home-roasted-dark-ceylon-curry-powder-cinnamon',
      sku: 'KSP-SPC-003',
      categorySlug: 'homemade-pantry',
      subCategorySlug: 'ceylon-spices',
      description:
        'Freshly pan-roasted dark curry powder (BadaThunaPaha) blended with Matale cloves, cardamom, coriander, cumin, curry leaves, and pandan leaf, paired with true Ceylon Alba grade cinnamon quills.',
      highlights: [
        'Stone-milled weekly for maximum aroma',
        'Includes 250g Dark Roasted Curry Powder + 100g Ceylon Cinnamon Quills',
        'Resealable foil freshness pouches'
      ],
      priceLkr: 1450,
      compareAtPriceLkr: 1750,
      stock: 60,
      images: [
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Pack Option',
          values: [
            { label: 'Combo Pack (350g Total)', priceLkr: 1450, stock: 60 },
            { label: 'Chef Bulk Pack (700g Total)', priceLkr: 2650, stock: 25 }
          ]
        }
      ],
      isHomemade: true,
      isFeatured: false,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.8,
      reviewCount: 33,
      soldCount: 91,
      tags: ['spices', 'curry powder', 'cinnamon', 'homemade', 'kandy'],
      createdAt: '2026-09-16T10:00:00.000Z'
    },
    {
      _id: 'prd_4',
      sellerId: 'sel_colombo_2',
      sellerName: 'Colombo Tech Hub',
      sellerSlug: 'colombo-tech-hub',
      sellerDistrict: 'Colombo',
      sellerType: 'Verified Retail Vendor',
      title: 'SoundCore Pro ANC Wireless Over-Ear Headphones (40H Playtime, USB-C)',
      slug: 'soundcore-pro-anc-wireless-headphones',
      sku: 'CTH-AUD-101',
      categorySlug: 'electronics',
      subCategorySlug: 'headphones-audio',
      description:
        'Active Noise Cancelling Bluetooth 5.3 over-ear headphones with 40 hours battery life, fast USB-C charging, dual-device connection, and crystal-clear microphone for remote work and travel.',
      highlights: [
        '6 Months Colombo Tech Hub Seller Warranty',
        'Hybrid Active Noise Cancellation + Transparency Mode',
        '40 Hours battery life (5 mins charge = 4 hours listening)',
        'Fast dispatch from Colombo 04'
      ],
      priceLkr: 8950,
      compareAtPriceLkr: 11500,
      stock: 28,
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Color',
          values: [
            { label: 'Matte Slate Black', priceLkr: 8950, stock: 18 },
            { label: 'Silver Frost', priceLkr: 9200, stock: 10 }
          ]
        }
      ],
      isHomemade: false,
      isFeatured: true,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.8,
      reviewCount: 74,
      soldCount: 162,
      tags: ['headphones', 'bluetooth', 'electronics', 'audio', 'colombo'],
      createdAt: '2026-09-18T10:00:00.000Z'
    },
    {
      _id: 'prd_5',
      sellerId: 'sel_colombo_2',
      sellerName: 'Colombo Tech Hub',
      sellerSlug: 'colombo-tech-hub',
      sellerDistrict: 'Colombo',
      sellerType: 'Verified Retail Vendor',
      title: '20,000mAh 22.5W Fast Charging Power Bank with Built-in LED Display',
      slug: '20000mah-22-5w-fast-charging-power-bank',
      sku: 'CTH-PWR-102',
      categorySlug: 'electronics',
      subCategorySlug: 'pc-accessories',
      description:
        'Essential backup power for Sri Lankan commuters and travelers. High-density 20,000mAh Li-Polymer battery with 22.5W PD/QC 3.0 fast output, dual USB-A + bidirectional USB-C port, and digital percentage display.',
      highlights: [
        'Charges most smartphones 3.5 to 4 times on a single charge',
        'Supports 20W PD for iPhone & 22.5W SuperCharge for Android',
        'Over-voltage and temperature surge protection',
        '6 Months Replacement Warranty'
      ],
      priceLkr: 5490,
      compareAtPriceLkr: 6900,
      stock: 52,
      images: [
        'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Capacity',
          values: [
            { label: '20,000mAh (22.5W)', priceLkr: 5490, stock: 52 },
            { label: '30,000mAh Heavy Duty', priceLkr: 7850, stock: 19 }
          ]
        }
      ],
      isHomemade: false,
      isFeatured: true,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.9,
      reviewCount: 92,
      soldCount: 310,
      tags: ['power bank', 'charger', 'electronics', 'mobile accessories'],
      createdAt: '2026-09-19T10:00:00.000Z'
    },
    {
      _id: 'prd_6',
      sellerId: 'sel_colombo_2',
      sellerName: 'Colombo Tech Hub',
      sellerSlug: 'colombo-tech-hub',
      sellerDistrict: 'Colombo',
      sellerType: 'Verified Retail Vendor',
      title: 'Foldable Aluminum Laptop Cooling Stand with 6-Level Height Adjustment',
      slug: 'foldable-aluminum-laptop-cooling-stand',
      sku: 'CTH-ACC-103',
      categorySlug: 'electronics',
      subCategorySlug: 'pc-accessories',
      description:
        'Ergonomic anodized aluminum alloy desk stand compatible with all 11-inch to 17.3-inch laptops and tablets. Improves airflow in warm weather and prevents neck & wrist strain.',
      highlights: [
        'Heavy-duty 4mm aluminum alloy supports up to 20kg',
        'Non-slip silicone pads + carry pouch included',
        'Open-back airflow design keeps laptop cool'
      ],
      priceLkr: 2450,
      compareAtPriceLkr: 3200,
      stock: 64,
      images: [
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Finish',
          values: [
            { label: 'Silver Anodized', priceLkr: 2450, stock: 40 },
            { label: 'Space Gray', priceLkr: 2550, stock: 24 }
          ]
        }
      ],
      isHomemade: false,
      isFeatured: false,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.7,
      reviewCount: 41,
      soldCount: 128,
      tags: ['laptop stand', 'pc accessories', 'work from home'],
      createdAt: '2026-09-20T10:00:00.000Z'
    },
    {
      _id: 'prd_7',
      sellerId: 'sel_galle_3',
      sellerName: 'Ruhunu Clay & Handloom Co.',
      sellerSlug: 'ruhunu-clay-handloom',
      sellerDistrict: 'Galle',
      sellerType: 'Artisan & Craft',
      title: 'Pre-Seasoned Southern Terracotta Clay Curry Pot Set (3-Piece Walan Set with Lids)',
      slug: 'pre-seasoned-terracotta-clay-curry-pot-set',
      sku: 'RCH-CLY-201',
      categorySlug: 'home-kitchen',
      subCategorySlug: 'clay-cookware',
      description:
        'Handcrafted on the potter’s wheel by village artisans in Southern Sri Lanka and pre-seasoned with coconut oil & rice water so you can cook directly on gas or firewood stoves. Ideal for fish ambul thiyal, dhal curry, and polos.',
      highlights: [
        'Handcrafted by rural pottery families in Matara & Galle',
        'Pre-seasoned (Padam Kala) — ready for gas or firewood stove',
        'Includes Medium (1.5L), Large (2.2L), and Flat Athiliya with clay lids + 2 coconut spoons',
        'Double-boxed shockproof packaging for safe islandwide delivery'
      ],
      priceLkr: 3250,
      compareAtPriceLkr: 3900,
      stock: 22,
      images: [
        'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Set Size',
          values: [
            { label: '3-Pot Set + 2 Katu Handi', priceLkr: 3250, stock: 22 },
            { label: '5-Pot Complete Kitchen Set', priceLkr: 4950, stock: 11 }
          ]
        }
      ],
      isHomemade: true,
      isFeatured: true,
      isDeal: false,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.9,
      reviewCount: 53,
      soldCount: 140,
      tags: ['clay pot', 'walan', 'cookware', 'handmade', 'kitchen', 'galle'],
      createdAt: '2026-09-21T10:00:00.000Z'
    },
    {
      _id: 'prd_8',
      sellerId: 'sel_galle_3',
      sellerName: 'Ruhunu Clay & Handloom Co.',
      sellerSlug: 'ruhunu-clay-handloom',
      sellerDistrict: 'Galle',
      sellerType: 'Artisan & Craft',
      title: 'Handwoven 100% Cotton Sri Lankan Handloom Unisex Sarong (Galle Loom)',
      slug: 'handwoven-cotton-sri-lankan-handloom-sarong',
      sku: 'RCH-HLM-202',
      categorySlug: 'fashion-handloom',
      subCategorySlug: 'mens-wear',
      description:
        'Woven on traditional wooden handlooms in Galle using breathable 2-ply combed cotton yarn. Fast colors, stitched seam ready to wear, comfortable for tropical Sri Lankan weather and festive occasions.',
      highlights: [
        '100% Breathable Handloom Cotton — cool & durable',
        'Already stitched and pre-washed against shrinkage',
        'Supports women handloom weavers in Galle District'
      ],
      priceLkr: 2350,
      compareAtPriceLkr: 2850,
      stock: 38,
      images: [
        'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Color Pattern',
          values: [
            { label: 'Deep Indigo & White Stripe', priceLkr: 2350, stock: 15 },
            { label: 'Cinnamon Amber & Charcoal', priceLkr: 2350, stock: 13 },
            { label: 'Emerald Forest Check', priceLkr: 2350, stock: 10 }
          ]
        }
      ],
      isHomemade: true,
      isFeatured: false,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.8,
      reviewCount: 29,
      soldCount: 84,
      tags: ['handloom', 'sarong', 'cotton', 'sri lankan fashion'],
      createdAt: '2026-09-22T10:00:00.000Z'
    },
    {
      _id: 'prd_9',
      sellerId: 'sel_gampaha_4',
      sellerName: 'OsuLanka Herbal & Wellness',
      sellerSlug: 'osulanka-herbal-wellness',
      sellerDistrict: 'Gampaha',
      sellerType: 'Small Business',
      title: 'King Coconut, Gotukola & Fenugreek Ayurvedic Hair Growth Oil (200ml)',
      slug: 'king-coconut-gotukola-ayurvedic-hair-oil',
      sku: 'OSL-AYU-301',
      categorySlug: 'ayurveda-beauty',
      subCategorySlug: 'hair-care',
      description:
        'Traditional Sri Lankan herbal oil infusion prepared with cold-pressed Thambili (King Coconut) oil, fresh Gotukola, Mukunuwenna, Karapincha, Savandara root, and Uluhal (fenugreek). Reduces hair fall and cools the scalp.',
      highlights: [
        '100% Natural Ayurvedic formulation — Zero mineral oil or parabens',
        'Infused over slow heat for 18 hours with fresh Gampaha herbs',
        'Suitable for daily scalp massage or overnight conditioning'
      ],
      priceLkr: 1490,
      compareAtPriceLkr: 1850,
      stock: 75,
      images: [
        'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Bottle Size',
          values: [
            { label: '200ml Bottle', priceLkr: 1490, stock: 75 },
            { label: 'Twin Value Pack (2 x 200ml)', priceLkr: 2750, stock: 30 }
          ]
        }
      ],
      isHomemade: true,
      isFeatured: true,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.9,
      reviewCount: 64,
      soldCount: 220,
      tags: ['ayurveda', 'hair oil', 'king coconut', 'herbal', 'homemade'],
      createdAt: '2026-09-23T10:00:00.000Z'
    },
    {
      _id: 'prd_10',
      sellerId: 'sel_gampaha_4',
      sellerName: 'OsuLanka Herbal & Wellness',
      sellerSlug: 'osulanka-herbal-wellness',
      sellerDistrict: 'Gampaha',
      sellerType: 'Small Business',
      title: 'Venivelgata, White Sandalwood & Wild Turmeric Brightening Face Pack (150g)',
      slug: 'venivelgata-sandalwood-turmeric-face-pack',
      sku: 'OSL-AYU-302',
      categorySlug: 'ayurveda-beauty',
      subCategorySlug: 'skincare',
      description:
        'Finely sifted pure Sri Lankan Venivelgata, Kokum bark, White Sandalwood (Sudu Handun), and Kasturi Kaha (wild cosmetic turmeric) powder. Mix with rose water, milk, or king coconut water for natural clear skin.',
      highlights: [
        'Non-staining wild Kasturi Kaha + pure Venivelgata',
        'Free from synthetic fragrance, bleach, or talc',
        'Handmade in small batches in Gampaha'
      ],
      priceLkr: 1290,
      compareAtPriceLkr: 1590,
      stock: 50,
      images: [
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Size',
          values: [{ label: '150g Jar', priceLkr: 1290, stock: 50 }]
        }
      ],
      isHomemade: true,
      isFeatured: false,
      isDeal: false,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.8,
      reviewCount: 38,
      soldCount: 115,
      tags: ['venivel', 'sandalwood', 'skincare', 'ayurveda'],
      createdAt: '2026-09-24T10:00:00.000Z'
    },
    {
      _id: 'prd_11',
      sellerId: 'sel_colombo_2',
      sellerName: 'Colombo Tech Hub',
      sellerSlug: 'colombo-tech-hub',
      sellerDistrict: 'Colombo',
      sellerType: 'Verified Retail Vendor',
      title: 'AmazFit Pulse AMOLED Fitness Smartwatch (IP68 Waterproof, 10-Day Battery)',
      slug: 'amazfit-pulse-amoled-fitness-smartwatch',
      sku: 'CTH-WTC-104',
      categorySlug: 'electronics',
      subCategorySlug: 'smartwatches',
      description:
        'Crisp 1.85-inch AMOLED display smartwatch with Bluetooth calling, heart rate & SpO2 monitoring, 100+ sports modes, and IP68 water resistance.',
      highlights: [
        'Bluetooth Calling + WhatsApp/SMS notifications on wrist',
        'Up to 10 days battery life on a single magnetic charge',
        'Compatible with both Android and iOS'
      ],
      priceLkr: 6990,
      compareAtPriceLkr: 8900,
      stock: 34,
      images: [
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Strap Color',
          values: [
            { label: 'Obsidian Black', priceLkr: 6990, stock: 22 },
            { label: 'Slate Blue', priceLkr: 6990, stock: 12 }
          ]
        }
      ],
      isHomemade: false,
      isFeatured: true,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.7,
      reviewCount: 49,
      soldCount: 134,
      tags: ['smartwatch', 'fitness tracker', 'electronics'],
      createdAt: '2026-09-25T10:00:00.000Z'
    },
    {
      _id: 'prd_12',
      sellerId: 'sel_kandy_1',
      sellerName: 'Kandy Spice & Homemade Pantry',
      sellerSlug: 'kandy-spice-homemade-pantry',
      sellerDistrict: 'Kandy',
      sellerType: 'Homemade & Cottage',
      title: 'Crispy Homemade Polos Ambula & Maldive Fish Badum Twin Pack',
      slug: 'crispy-homemade-polos-ambula-maldive-fish-badum',
      sku: 'KSP-SNK-004',
      categorySlug: 'homemade-pantry',
      subCategorySlug: 'achcharu-sambol',
      description:
        'Ready-to-eat slow-cooked young jackfruit (Polos Ambula) in goraka & black pepper gravy + crispy caramelized onion & Maldive fish badum (Katta Sambol / Lunu Miris crunch). Lifesaver for busy workdays and university hostel students.',
      highlights: [
        'Home-cooked in Kandy using coconut oil and village goraka',
        'No artificial MSG or chemical preservatives',
        'Pack includes 1 x 350g Polos Ambula Jar + 1 x 200g Crispy Umbalakada Badum'
      ],
      priceLkr: 1890,
      compareAtPriceLkr: 2250,
      stock: 29,
      images: [
        'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Spice Level',
          values: [
            { label: 'Medium Kandyan Spice', priceLkr: 1890, stock: 19 },
            { label: 'Extra Spicy (Nai Miris)', priceLkr: 1950, stock: 10 }
          ]
        }
      ],
      isHomemade: true,
      isFeatured: true,
      isDeal: false,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.9,
      reviewCount: 37,
      soldCount: 98,
      tags: ['polos', 'badum', 'sambol', 'homemade', 'sri lankan food'],
      createdAt: '2026-09-26T10:00:00.000Z'
    },
    {
      _id: 'prd_13',
      sellerId: 'sel_galle_3',
      sellerName: 'Ruhunu Clay & Handloom Co.',
      sellerSlug: 'ruhunu-clay-handloom',
      sellerDistrict: 'Galle',
      sellerType: 'Artisan & Craft',
      title: 'Women’s Tropical Hand-Dyed Batik & Linen Everyday Kurta Top',
      slug: 'womens-tropical-batik-linen-kurta-top',
      sku: 'RCH-FAS-203',
      categorySlug: 'fashion-handloom',
      subCategorySlug: 'womens-wear',
      description:
        'Lightweight cotton-linen kurta top featuring subtle hand-waxed Southern Sri Lankan batik motifs along the neckline and cuffs. Tailored for workwear or casual outings.',
      highlights: [
        'Handcrafted wax-resist Batik detail by Galle artisans',
        'Soft, breathable linen-cotton blend ideal for humid climate',
        'Colorfast pre-treated fabric'
      ],
      priceLkr: 2890,
      compareAtPriceLkr: 3450,
      stock: 26,
      images: [
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Size',
          values: [
            { label: 'Small (UK 8-10)', priceLkr: 2890, stock: 8 },
            { label: 'Medium (UK 12)', priceLkr: 2890, stock: 10 },
            { label: 'Large (UK 14-16)', priceLkr: 2890, stock: 8 }
          ]
        }
      ],
      isHomemade: true,
      isFeatured: false,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.8,
      reviewCount: 22,
      soldCount: 65,
      tags: ['batik', 'womens fashion', 'linen', 'handcrafted'],
      createdAt: '2026-09-27T10:00:00.000Z'
    },
    {
      _id: 'prd_14',
      sellerId: 'sel_colombo_2',
      sellerName: 'Colombo Tech Hub',
      sellerSlug: 'colombo-tech-hub',
      sellerDistrict: 'Colombo',
      sellerType: 'Verified Retail Vendor',
      title: '1000ml Double-Wall Insulated Stainless Steel Thermo Flask (Hot & Cold 24H)',
      slug: '1000ml-insulated-stainless-steel-thermo-flask',
      sku: 'CTH-LIF-105',
      categorySlug: 'fitness-daily-deals',
      subCategorySlug: 'flasks-bottles',
      description:
        'Food-grade 304 stainless steel vacuum flask that keeps water icy cold for 24 hours or tea/coffee piping hot for 12 hours. Leakproof BPA-free lid with carry loop.',
      highlights: [
        '1 Liter capacity — ideal for office, gym, or road trips',
        '304 Food-Grade Stainless Steel with sweat-free powder coat',
        'Fits standard car cup holders and backpack pockets'
      ],
      priceLkr: 1450,
      compareAtPriceLkr: 1990,
      stock: 80,
      images: [
        'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Color',
          values: [
            { label: 'Matte Slate Charcoal', priceLkr: 1450, stock: 45 },
            { label: 'Deep Navy Blue', priceLkr: 1450, stock: 35 }
          ]
        }
      ],
      isHomemade: false,
      isFeatured: false,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.7,
      reviewCount: 31,
      soldCount: 145,
      tags: ['water bottle', 'flask', 'under 1500', 'deals'],
      createdAt: '2026-09-28T10:00:00.000Z'
    },
    {
      _id: 'prd_15',
      sellerId: 'sel_colombo_2',
      sellerName: 'Colombo Tech Hub',
      sellerSlug: 'colombo-tech-hub',
      sellerDistrict: 'Colombo',
      sellerType: 'Verified Retail Vendor',
      title: 'Adjustable Neoprene Dumbbell Pair & Resistance Band Home Workout Kit',
      slug: 'adjustable-neoprene-dumbbell-resistance-band-kit',
      sku: 'CTH-FIT-106',
      categorySlug: 'fitness-daily-deals',
      subCategorySlug: 'fitness-equipment',
      description:
        'Non-slip hex neoprene dumbbell pair (2 x 3kg) bundled with 3 heavy-duty latex resistance loop bands for convenient home strength training.',
      highlights: [
        'Anti-roll hexagon design protects tiled floors',
        'Includes 2 x 3kg Dumbbells + 3 Resistance Bands (Light, Medium, Heavy)'
      ],
      priceLkr: 4450,
      compareAtPriceLkr: 5600,
      stock: 19,
      images: [
        'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Weight Set',
          values: [
            { label: '2 x 3kg + Bands', priceLkr: 4450, stock: 19 },
            { label: '2 x 5kg + Bands', priceLkr: 6450, stock: 10 }
          ]
        }
      ],
      isHomemade: false,
      isFeatured: false,
      isDeal: true,
      codEligible: true,
      approvalStatus: 'approved',
      rating: 4.8,
      reviewCount: 19,
      soldCount: 54,
      tags: ['fitness', 'dumbbells', 'gym', 'workout'],
      createdAt: '2026-09-29T10:00:00.000Z'
    },
    {
      _id: 'prd_16',
      sellerId: 'sel_kandy_1',
      sellerName: 'Kandy Spice & Homemade Pantry',
      sellerSlug: 'kandy-spice-homemade-pantry',
      sellerDistrict: 'Kandy',
      sellerType: 'Homemade & Cottage',
      title: 'Homemade Kithul Jaggery (Kithul Hakuru) & Cashew Gift Box (500g)',
      slug: 'homemade-kithul-jaggery-cashew-gift-box',
      sku: 'KSP-SWT-005',
      categorySlug: 'homemade-pantry',
      subCategorySlug: 'traditional-sweets',
      description:
        'Soft, melt-in-the-mouth Kotmale Kithul Jaggery infused with roasted Puttalam cashew nuts, cardamom, and ginger. Pending admin review for New Year collection.',
      highlights: [
        '100% Pure Kithul sap with crunchy cashew pieces',
        'Ideal companion for plain Ceylon tea (Kahaata)'
      ],
      priceLkr: 1950,
      compareAtPriceLkr: 2300,
      stock: 40,
      images: [
        'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=800&q=80'
      ],
      variants: [
        {
          name: 'Box Weight',
          values: [{ label: '500g Gift Box', priceLkr: 1950, stock: 40 }]
        }
      ],
      isHomemade: true,
      isFeatured: false,
      isDeal: false,
      codEligible: true,
      approvalStatus: 'pending', // Pending admin product moderation for demo!
      rating: 5.0,
      reviewCount: 0,
      soldCount: 0,
      tags: ['kithul', 'hakuru', 'jaggery', 'sweets', 'homemade'],
      createdAt: '2026-11-05T10:00:00.000Z'
    }
  ];

  const reviews = [
    {
      _id: 'rev_1',
      productId: 'prd_1',
      userId: 'usr_cust_1',
      customerName: 'Kasun Perera',
      district: 'Colombo',
      rating: 5,
      title: 'Best homemade Malay Achcharu I have ordered online!',
      comment:
        'Arrived safely in Colombo within 2 days with bubble wrap around the glass jar. Tastes just like authentic Kandy home-made achcharu with dates and small red onions.',
      verifiedPurchase: true,
      createdAt: '2026-10-18T14:20:00.000Z'
    },
    {
      _id: 'rev_2',
      productId: 'prd_1',
      userId: null,
      customerName: 'Dilani Wijesinghe',
      district: 'Gampaha',
      rating: 5,
      title: 'Fresh, thick gravy and zero chemical aftertaste',
      comment:
        'Ordered the 750g jar for a family lunch. Everyone asked where we bought it from. Will definitely re-order!',
      verifiedPurchase: true,
      createdAt: '2026-10-22T09:15:00.000Z'
    },
    {
      _id: 'rev_3',
      productId: 'prd_4',
      userId: 'usr_cust_1',
      customerName: 'Kasun Perera',
      district: 'Colombo',
      rating: 5,
      title: 'Great noise cancellation for Zoom calls',
      comment:
        'Delivered next day in Colombo via COD. Battery easily lasts a whole work week.',
      verifiedPurchase: true,
      createdAt: '2026-10-25T16:40:00.000Z'
    },
    {
      _id: 'rev_4',
      productId: 'prd_7',
      userId: null,
      customerName: 'Chathurika Silva',
      district: 'Kalutara',
      rating: 5,
      title: 'Already seasoned and packed super carefully',
      comment:
        'Was worried about ordering clay pots by courier, but Ruhunu Clay packed each pot in thick cardboard cushioning. Cooked fish curry the same evening!',
      verifiedPurchase: true,
      createdAt: '2026-10-29T11:30:00.000Z'
    }
  ];

  // Sample Multi-Seller Order 1: YLK-2026-1001 (Split into 2 Seller SubOrders!)
  const subOrders = [
    {
      _id: 'sub_1001_s1',
      subOrderNumber: 'YLK-2026-1001-S1',
      parentOrderId: 'ord_1001',
      parentOrderNumber: 'YLK-2026-1001',
      sellerId: 'sel_kandy_1',
      sellerName: 'Kandy Spice & Homemade Pantry',
      sellerDistrict: 'Kandy',
      customerName: 'Kasun Perera',
      customerPhone: '0774123987',
      shippingAddress: {
        recipientName: 'Kasun Perera',
        phone: '0774123987',
        addressLine1: 'No. 42/B, Fife Road, Thimbirigasyaya',
        addressLine2: 'Near Isipathana Mawatha',
        city: 'Colombo 05',
        district: 'Colombo',
        postalCode: '00500',
        deliveryNotes: 'Call before arrival at gate'
      },
      items: [
        {
          productId: 'prd_1',
          title: 'Homemade Kandyan Malay Achcharu (Glass Jar - Traditional Recipe)',
          image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
          sku: 'KSP-ACH-001',
          variantLabel: '375g Glass Jar',
          unitPriceLkr: 1150,
          quantity: 2,
          lineTotalLkr: 2300,
          sellerId: 'sel_kandy_1',
          sellerName: 'Kandy Spice & Homemade Pantry',
          sellerDistrict: 'Kandy'
        },
        {
          productId: 'prd_2',
          title: 'Pure Kotmale Kithul Treacle (100% Unadulterated Pani - 375ml Bottle)',
          image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=400&q=80',
          sku: 'KSP-KTH-002',
          variantLabel: '375ml Bottle',
          unitPriceLkr: 1650,
          quantity: 1,
          lineTotalLkr: 1650,
          sellerId: 'sel_kandy_1',
          sellerName: 'Kandy Spice & Homemade Pantry',
          sellerDistrict: 'Kandy'
        }
      ],
      itemsSubtotalLkr: 3950,
      deliveryFeeLkr: 0, // Over Rs. 3,500 seller free shipping threshold!
      grossTotalLkr: 3950,
      commissionRatePercent: 5,
      commissionAmountLkr: 198,
      netSellerEarningsLkr: 3752,
      paymentMethod: 'COD',
      codCollectionStatus: 'remitted_to_platform',
      codCollectedAt: '2026-11-04T15:10:00.000Z',
      fulfillmentStatus: 'delivered',
      trackingCode: 'PXP-KDY-882190',
      courierPartner: 'Prompt Xpress SL',
      settlementStatus: 'eligible_for_payout',
      settlementId: null,
      statusHistory: [
        { status: 'confirmed', note: 'COD Order confirmed', timestamp: '2026-11-02T10:00:00.000Z' },
        { status: 'packed', note: 'Glass jars bubble-wrapped & sealed in Kandy', timestamp: '2026-11-02T16:30:00.000Z' },
        { status: 'shipped', note: 'Handed over to Prompt Xpress Kandy Hub', timestamp: '2026-11-03T09:00:00.000Z' },
        { status: 'delivered', note: 'Delivered in Colombo 05 & Rs. 3,950 COD cash collected', timestamp: '2026-11-04T15:10:00.000Z' }
      ],
      createdAt: '2026-11-02T10:00:00.000Z'
    },
    {
      _id: 'sub_1001_s2',
      subOrderNumber: 'YLK-2026-1001-S2',
      parentOrderId: 'ord_1001',
      parentOrderNumber: 'YLK-2026-1001',
      sellerId: 'sel_colombo_2',
      sellerName: 'Colombo Tech Hub',
      sellerDistrict: 'Colombo',
      customerName: 'Kasun Perera',
      customerPhone: '0774123987',
      shippingAddress: {
        recipientName: 'Kasun Perera',
        phone: '0774123987',
        addressLine1: 'No. 42/B, Fife Road, Thimbirigasyaya',
        addressLine2: 'Near Isipathana Mawatha',
        city: 'Colombo 05',
        district: 'Colombo',
        postalCode: '00500',
        deliveryNotes: 'Call before arrival at gate'
      },
      items: [
        {
          productId: 'prd_5',
          title: '20,000mAh 22.5W Fast Charging Power Bank with Built-in LED Display',
          image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=400&q=80',
          sku: 'CTH-PWR-102',
          variantLabel: '20,000mAh (22.5W)',
          unitPriceLkr: 5490,
          quantity: 1,
          lineTotalLkr: 5490,
          sellerId: 'sel_colombo_2',
          sellerName: 'Colombo Tech Hub',
          sellerDistrict: 'Colombo'
        }
      ],
      itemsSubtotalLkr: 5490,
      deliveryFeeLkr: 280, // Same-district Colombo -> Colombo rate
      grossTotalLkr: 5770,
      commissionRatePercent: 8,
      commissionAmountLkr: 439,
      netSellerEarningsLkr: 5051,
      paymentMethod: 'COD',
      codCollectionStatus: 'remitted_to_platform',
      codCollectedAt: '2026-11-03T14:00:00.000Z',
      fulfillmentStatus: 'delivered',
      trackingCode: 'DMX-CMB-441022',
      courierPartner: 'Domex Courier SL',
      settlementStatus: 'settled',
      settlementId: 'stl_101',
      statusHistory: [
        { status: 'confirmed', note: 'Order confirmed', timestamp: '2026-11-02T10:00:00.000Z' },
        { status: 'shipped', note: 'Dispatched from Bambalapitiya store', timestamp: '2026-11-02T15:00:00.000Z' },
        { status: 'delivered', note: 'Delivered & COD Rs. 5,770 collected', timestamp: '2026-11-03T14:00:00.000Z' }
      ],
      createdAt: '2026-11-02T10:00:00.000Z'
    },
    {
      _id: 'sub_1002_s1',
      subOrderNumber: 'YLK-2026-1002-S1',
      parentOrderId: 'ord_1002',
      parentOrderNumber: 'YLK-2026-1002',
      sellerId: 'sel_kandy_1',
      sellerName: 'Kandy Spice & Homemade Pantry',
      sellerDistrict: 'Kandy',
      customerName: 'Nadeesha Jayawardena',
      customerPhone: '0719008877',
      shippingAddress: {
        recipientName: 'Nadeesha Jayawardena',
        phone: '0719008877',
        addressLine1: 'No. 15, Temple Road',
        addressLine2: '',
        city: 'Maharagama',
        district: 'Colombo',
        postalCode: '10280',
        deliveryNotes: 'Deliver before 5 PM'
      },
      items: [
        {
          productId: 'prd_3',
          title: 'Home-Roasted Dark Ceylon Curry Powder & Alba Cinnamon Value Pack',
          image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
          sku: 'KSP-SPC-003',
          variantLabel: 'Combo Pack (350g Total)',
          unitPriceLkr: 1450,
          quantity: 1,
          lineTotalLkr: 1450,
          sellerId: 'sel_kandy_1',
          sellerName: 'Kandy Spice & Homemade Pantry',
          sellerDistrict: 'Kandy'
        },
        {
          productId: 'prd_12',
          title: 'Crispy Homemade Polos Ambula & Maldive Fish Badum Twin Pack',
          image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80',
          sku: 'KSP-SNK-004',
          variantLabel: 'Medium Kandyan Spice',
          unitPriceLkr: 1890,
          quantity: 1,
          lineTotalLkr: 1890,
          sellerId: 'sel_kandy_1',
          sellerName: 'Kandy Spice & Homemade Pantry',
          sellerDistrict: 'Kandy'
        }
      ],
      itemsSubtotalLkr: 3340,
      deliveryFeeLkr: 420, // Kandy (Central) -> Colombo (Western) Outstation rate
      grossTotalLkr: 3760,
      commissionRatePercent: 5,
      commissionAmountLkr: 167,
      netSellerEarningsLkr: 3173,
      paymentMethod: 'COD',
      codCollectionStatus: 'pending_collection',
      codCollectedAt: null,
      fulfillmentStatus: 'packed',
      trackingCode: 'PXP-KDY-889014',
      courierPartner: 'Prompt Xpress SL',
      settlementStatus: 'unsettled',
      settlementId: null,
      statusHistory: [
        { status: 'confirmed', note: 'COD Order confirmed via phone', timestamp: '2026-11-07T09:30:00.000Z' },
        { status: 'packed', note: 'Packed and ready for courier pickup', timestamp: '2026-11-07T14:20:00.000Z' }
      ],
      createdAt: '2026-11-07T09:30:00.000Z'
    },
    {
      _id: 'sub_1002_s2',
      subOrderNumber: 'YLK-2026-1002-S2',
      parentOrderId: 'ord_1002',
      parentOrderNumber: 'YLK-2026-1002',
      sellerId: 'sel_galle_3',
      sellerName: 'Ruhunu Clay & Handloom Co.',
      sellerDistrict: 'Galle',
      customerName: 'Nadeesha Jayawardena',
      customerPhone: '0719008877',
      shippingAddress: {
        recipientName: 'Nadeesha Jayawardena',
        phone: '0719008877',
        addressLine1: 'No. 15, Temple Road',
        addressLine2: '',
        city: 'Maharagama',
        district: 'Colombo',
        postalCode: '10280',
        deliveryNotes: 'Deliver before 5 PM'
      },
      items: [
        {
          productId: 'prd_7',
          title: 'Pre-Seasoned Southern Terracotta Clay Curry Pot Set (3-Piece Walan Set with Lids)',
          image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
          sku: 'RCH-CLY-201',
          variantLabel: '3-Pot Set + 2 Katu Handi',
          unitPriceLkr: 3250,
          quantity: 1,
          lineTotalLkr: 3250,
          sellerId: 'sel_galle_3',
          sellerName: 'Ruhunu Clay & Handloom Co.',
          sellerDistrict: 'Galle'
        }
      ],
      itemsSubtotalLkr: 3250,
      deliveryFeeLkr: 420, // Galle (Southern) -> Colombo (Western)
      grossTotalLkr: 3670,
      commissionRatePercent: 6,
      commissionAmountLkr: 195,
      netSellerEarningsLkr: 3055,
      paymentMethod: 'COD',
      codCollectionStatus: 'pending_collection',
      codCollectedAt: null,
      fulfillmentStatus: 'shipped',
      trackingCode: 'DMX-GLE-332198',
      courierPartner: 'Domex Courier SL',
      settlementStatus: 'unsettled',
      settlementId: null,
      statusHistory: [
        { status: 'confirmed', note: 'COD Order confirmed', timestamp: '2026-11-07T09:30:00.000Z' },
        { status: 'shipped', note: 'Dispatched from Galle Pottery Workshop', timestamp: '2026-11-07T17:00:00.000Z' }
      ],
      createdAt: '2026-11-07T09:30:00.000Z'
    }
  ];

  const orders = [
    {
      _id: 'ord_1001',
      orderNumber: 'YLK-2026-1001',
      userId: 'usr_cust_1',
      isGuestOrder: false,
      customerEmail: 'kasun@gmail.com',
      customerPhone: '0774123987',
      shippingAddress: {
        recipientName: 'Kasun Perera',
        phone: '0774123987',
        addressLine1: 'No. 42/B, Fife Road, Thimbirigasyaya',
        addressLine2: 'Near Isipathana Mawatha',
        city: 'Colombo 05',
        district: 'Colombo',
        postalCode: '00500',
        deliveryNotes: 'Call before arrival at gate'
      },
      items: [...subOrders[0].items, ...subOrders[1].items],
      subOrderIds: ['sub_1001_s1', 'sub_1001_s2'],
      sellerCount: 2,
      itemsSubtotalLkr: 9440,
      totalDeliveryFeeLkr: 280,
      grandTotalLkr: 9720,
      paymentMethod: 'COD',
      codConfirmedByCustomer: true,
      overallStatus: 'delivered',
      createdAt: '2026-11-02T10:00:00.000Z'
    },
    {
      _id: 'ord_1002',
      orderNumber: 'YLK-2026-1002',
      userId: null,
      isGuestOrder: true,
      customerEmail: 'nadeesha.j@gmail.com',
      customerPhone: '0719008877',
      shippingAddress: {
        recipientName: 'Nadeesha Jayawardena',
        phone: '0719008877',
        addressLine1: 'No. 15, Temple Road',
        addressLine2: '',
        city: 'Maharagama',
        district: 'Colombo',
        postalCode: '10280',
        deliveryNotes: 'Deliver before 5 PM'
      },
      items: [...subOrders[2].items, ...subOrders[3].items],
      subOrderIds: ['sub_1002_s1', 'sub_1002_s2'],
      sellerCount: 2,
      itemsSubtotalLkr: 6590,
      totalDeliveryFeeLkr: 840,
      grandTotalLkr: 7430,
      paymentMethod: 'COD',
      codConfirmedByCustomer: true,
      overallStatus: 'partially_shipped',
      createdAt: '2026-11-07T09:30:00.000Z'
    }
  ];

  const settlements = [
    {
      _id: 'stl_101',
      settlementReference: 'STL-YLK-2026-001',
      sellerId: 'sel_colombo_2',
      sellerName: 'Colombo Tech Hub',
      subOrderIds: ['sub_1001_s2'],
      grossOrderItemsLkr: 5490,
      platformCommissionLkr: 439,
      netPayoutLkr: 5051,
      bankReference: 'CEFT-COMB-9941203',
      status: 'paid',
      paidAt: '2026-11-05T11:00:00.000Z',
      notes: 'Weekly COD settlement payout for delivered Colombo Tech Hub orders.'
    }
  ];

  const platformConfig = {
    _id: 'cfg_main_1',
    key: 'main_config',
    defaultCommissionPercent: 8.0,
    homemadeCommissionPercent: 5.0,
    codEnabledGlobally: true,
    codMaxOrderLimitLkr: 75000,
    globalFreeShippingMinLkr: 0,
    supportPhone: '+94 11 234 5678',
    supportWhatsapp: '+94 77 123 4567',
    districts: SRI_LANKA_DISTRICTS,
    banners: [
      {
        id: 'bnr_1',
        badge: 'ISLANDWIDE CASH ON DELIVERY',
        title: 'Authentic Sri Lankan Homemade & Everyday Essentials',
        subtitle:
          'Shop directly from home kitchens in Kandy, artisans in Galle, and verified tech sellers in Colombo — delivered across all 25 districts.',
        ctaText: 'Explore Homemade Finds',
        ctaLink: '/products?homemade=true',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1000&q=80',
        bgClass: 'bg-slate-900',
        active: true
      },
      {
        id: 'bnr_2',
        badge: 'DAILY VALUE DEALS IN LKR',
        title: 'Work From Home & Tech Accessories Under Rs. 9,000',
        subtitle:
          'Genuine power banks, noise-cancelling headphones, and laptop stands with seller warranty and same-day Colombo dispatch.',
        ctaText: 'Shop Tech Deals',
        ctaLink: '/products?category=electronics',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
        bgClass: 'bg-slate-800',
        active: true
      },
      {
        id: 'bnr_3',
        badge: 'EMPOWERING LOCAL VENDORS',
        title: 'Sell on Yaans.lk – Home-Based Sellers & Small Businesses Welcome',
        subtitle:
          'Low 5% homemade commission, automated district delivery fee calculation, and weekly bank settlements.',
        ctaText: 'Become a Seller',
        ctaLink: '/seller/register',
        imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1000&q=80',
        bgClass: 'bg-neutral-900',
        active: true
      }
    ]
  };

  return {
    users,
    sellers,
    categories,
    products,
    reviews,
    subOrders,
    orders,
    settlements,
    platformConfig
  };
}
