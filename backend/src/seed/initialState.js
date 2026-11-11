import { SRI_LANKA_DISTRICTS } from '../config/sriLankaDistricts.js';

export function getInitialSeedState() {
  const users = [];
  const sellers = [];

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

  const products = [];
  const reviews = [];
  const subOrders = [];
  const orders = [];
  const settlements = [];

  const platformConfig = {
    _id: 'cfg_main_1',
    key: 'main_config',
    defaultCommissionPercent: 8.0,
    homemadeCommissionPercent: 5.0,
    codEnabledGlobally: true,
    codMaxOrderLimitLkr: 75000,
    globalFreeShippingMinLkr: 0,
    shippingMode: 'custom', // 'custom' (25-district matrix) or 'flat' (one unified shipping rate for all places)
    flatShippingRateLkr: 350,
    supportPhone: '+94 11 234 5678',
    supportWhatsapp: '+94 77 123 4567',
    districts: SRI_LANKA_DISTRICTS,
    banners: [
      {
        id: 'bnr_1',
        title: 'Sri Lankan Homemade & Everyday Essentials',
        categorySlug: 'homemade-pantry',
        ctaLink: '/products?category=homemade-pantry',
        imageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337090/yaans_lk/banners/ylk_banner_essentials_desktop_1794337086304.webp',
        mobileImageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337091/yaans_lk/banners/ylk_banner_essentials_mobile_1794337090161.webp',
        active: true,
        displayOrder: 1
      },
      {
        id: 'bnr_2',
        title: 'Electronics & Tech Accessories',
        categorySlug: 'electronics',
        ctaLink: '/products?category=electronics',
        imageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337092/yaans_lk/banners/ylk_banner_electronics_desktop_1794337091218.webp',
        mobileImageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337093/yaans_lk/banners/ylk_banner_electronics_mobile_1794337092146.webp',
        active: true,
        displayOrder: 2
      },
      {
        id: 'bnr_3',
        title: 'Ceylon Spices & Local Homemade Goods',
        categorySlug: 'homemade-pantry',
        ctaLink: '/products?category=homemade-pantry',
        imageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337094/yaans_lk/banners/ylk_banner_spices_desktop_1794337093073.webp',
        mobileImageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337095/yaans_lk/banners/ylk_banner_spices_mobile_1794337094020.webp',
        active: true,
        displayOrder: 3
      },
      {
        id: 'bnr_4',
        title: 'T-Shirts, Dresses & Island Fashion',
        categorySlug: 'fashion-handloom',
        ctaLink: '/products?category=fashion-handloom',
        imageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337096/yaans_lk/banners/ylk_banner_fashion_desktop_1794337095049.webp',
        mobileImageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337097/yaans_lk/banners/ylk_banner_fashion_mobile_1794337095980.webp',
        active: true,
        displayOrder: 4
      },
      {
        id: 'bnr_5',
        title: 'Tools & Home Improvement Essentials',
        categorySlug: '',
        ctaLink: '/products',
        imageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337099/yaans_lk/banners/ylk_banner_tools_desktop_1794337097302.webp',
        mobileImageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337100/yaans_lk/banners/ylk_banner_tools_mobile_1794337099509.webp',
        active: true,
        displayOrder: 5
      },
      {
        id: 'bnr_6',
        title: 'Baby & Kids Products',
        categorySlug: '',
        ctaLink: '/products',
        imageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337101/yaans_lk/banners/ylk_banner_baby_desktop_1794337100454.webp',
        mobileImageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337102/yaans_lk/banners/ylk_banner_baby_mobile_1794337101468.webp',
        active: true,
        displayOrder: 6
      },
      {
        id: 'bnr_7',
        title: 'Handmade Gifts & Local Crafts',
        categorySlug: '',
        ctaLink: '/products',
        imageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337103/yaans_lk/banners/ylk_banner_gifts_desktop_1794337102557.webp',
        mobileImageUrl: 'https://res.cloudinary.com/dfnxiumaq/image/upload/v1794337104/yaans_lk/banners/ylk_banner_gifts_mobile_1794337103523.webp',
        active: true,
        displayOrder: 7
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
