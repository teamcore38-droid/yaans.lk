import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {beforeEach,test,expect,vi} from 'vitest';
import Navbar from '../../src/components/Navbar.jsx';
import {useMarketplace,useBusinessConfiguration} from '../../src/context/MarketplaceContext.jsx';
vi.mock('../../src/context/MarketplaceContext.jsx',async original=>({...await original(),useMarketplace:vi.fn(),useBusinessConfiguration:vi.fn()}));
let district;
beforeEach(()=>{
  district=vi.fn();useBusinessConfiguration.mockReturnValue({});
  useMarketplace.mockReturnValue({user:null,logout:vi.fn(),selectedDistrict:'Colombo',setSelectedDistrict:district,totalCartItems:3,wishlistIds:['p1'],categories:[{slug:'ceramics',name:'Ceramics'}]});
});
function Location(){return <output aria-label="Current route">{useLocation().pathname+useLocation().search}</output>;}
function renderHeader(){return render(<MemoryRouter initialEntries={['/']}><Navbar/><Location/></MemoryRouter>);}

test('the red header uses the real white logo and preserves counters and mobile bottom navigation',()=>{
  renderHeader();
  expect(screen.getByRole('img',{name:'Yaans.lk Marketplace'})).toHaveAttribute('src','/brand/yaans-logo-horizontal-white.png');
  expect(screen.getAllByRole('link',{name:'Cart, 3 items'})).toHaveLength(2);
  expect(screen.getByRole('link',{name:'Wishlist'})).toHaveTextContent('1');
  expect(screen.getByRole('link',{name:'Browse'})).toHaveAttribute('href','/products');
});
test('a configured custom logo remains unchanged',()=>{
  useBusinessConfiguration.mockReturnValue({businessSettings:{identity:{logo:'/brand/custom-logo.png'}}});
  renderHeader();
  expect(screen.getByRole('img',{name:'Yaans.lk Marketplace'})).toHaveAttribute('src','/brand/custom-logo.png');
});
test('desktop category search still submits its category and query',()=>{
  renderHeader();
  fireEvent.change(screen.getByRole('combobox',{name:'Filter search by category'}),{target:{value:'ceramics'}});
  const input=screen.getAllByPlaceholderText('Handmade dresses, cane crafts, bouquets')[0];
  expect(screen.getAllByPlaceholderText('Handmade dresses, cane crafts, bouquets')).toHaveLength(2);
  fireEvent.change(input,{target:{value:'clay pots'}});fireEvent.submit(input.closest('form'));
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/products?q=clay+pots&category=ceramics');
});
test('drawer sign-in and district selection still work with the new theme',async()=>{
  renderHeader();const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Open categories menu'}));
  expect(screen.getByRole('link',{name:'Sign In',exact:true})).toHaveAttribute('href','/login?redirect=%2F');
  await user.click(screen.getByRole('link',{name:'Sign In',exact:true}));
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/login?redirect=%2F');
  await user.click(screen.getByRole('button',{name:'Deliver to Colombo ▾'}));
  await user.click(screen.getByRole('button',{name:'Kandy',exact:true}));
  expect(district).toHaveBeenCalledWith('Kandy');
  expect(screen.queryByText('Choose Your Delivery District')).not.toBeInTheDocument();
});
