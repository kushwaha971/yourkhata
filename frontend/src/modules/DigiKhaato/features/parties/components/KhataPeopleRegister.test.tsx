import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { PartyListPageContent } from './PartyListPageContent';

import type { PartyListParams } from '../types/party.types';

jest.mock('../api/partyService');jest.mock('../api/tagService');
const replace=jest.fn(),push=jest.fn();let mockSearch='';let mockPath='/khata';
jest.mock('next/navigation',()=>({useRouter:()=>({replace,push,back:jest.fn(),prefetch:jest.fn()}),usePathname:()=>mockPath,useSearchParams:()=>new URLSearchParams(mockSearch)}));
const service=jest.requireMock('../api/partyService') as {listParties:jest.Mock;createParty:jest.Mock};
const tags=jest.requireMock('../api/tagService') as {listTags:jest.Mock};
const person={id:'11111111-1111-4111-8111-111111111111',name:'Radhe Krishna Enterprises',displayCode:'C-001',mobile:'9794620535',isCustomer:true,isSupplier:false,balance:'500.00',status:'active',lastActivityAt:'2026-10-25T04:00:00Z',tags:[]};
const result={rows:[person],meta:{page:1,pageSize:25,total:30,totalPages:2,hasAny:true},totals:{receivable:'500.00',payable:'200.00'},totalsScope:'filtered',overLimit:0};
beforeEach(()=>{jest.clearAllMocks();store.dispatch(resetAllFeatureState());mockSearch='';mockPath='/khata';tags.listTags.mockResolvedValue([]);service.listParties.mockResolvedValue(result);Object.defineProperty(window,'matchMedia',{writable:true,value:(query:string)=>({matches:query.includes('max-width'),media:query,onchange:null,addEventListener:jest.fn(),removeEventListener:jest.fn(),addListener:jest.fn(),removeListener:jest.fn(),dispatchEvent:()=>false})});store.dispatch(sessionLoaded({user:{id:'u1',name:'Owner',email:'qa@test.local',mobile:null,locale:'en',mustChangePassword:false,passwordExpiresAt:null},activeTenant:{id:'t1',name:'Radhe Krishna Enterprises',timezone:'Asia/Kolkata',role:'owner'},tenants:[{id:'t1',name:'Radhe Krishna Enterprises',timezone:'Asia/Kolkata'}],permissions:['parties.party.read','parties.party.write'],enabledModules:['parties','ledger'],version:1}));});
const last=()=>service.listParties.mock.calls.at(-1)?.[0] as PartyListParams;

it('starts in Due with avatar, name, amount and one floating Add action',async()=>{
 /** Defect: Udhaar inherited tall stats, extra row metadata, Remind buttons and page arrows. */
 renderWithProviders(<PartyListPageContent book="main"/>);await screen.findByText(person.name);
 await waitFor(()=>expect(last()).toMatchObject({book:'main',balance:'due',status:'active'}));
 expect(screen.getByTestId('khata-people-toolbar')).toBeInTheDocument();expect(screen.getByTestId('filters-button')).toHaveAccessibleName('Filters');expect(screen.getByRole('searchbox')).toBeInTheDocument();
 expect(screen.queryByText('7 days ago')).not.toBeInTheDocument();
 expect(screen.queryByText('9794620535')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Remind'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'More actions'})).not.toBeInTheDocument();
 expect(screen.queryByTestId('ub-grid-pagination')).not.toBeInTheDocument();expect(document.querySelector('[data-ub-fab]')).not.toBeNull();
 expect(screen.getByTestId('ub-grid-scroll-region')).toContainElement(screen.getByRole('button',{name:'Load more'}));
 expect(replace.mock.calls.some(([url])=>url.includes('balance=due')&&url.includes('status=active'))).toBe(true);
 fireEvent.click(screen.getByText(person.name));
 expect(push).toHaveBeenCalledWith('/parties/'+person.id);
});
it('All clears only balance, and direction inside Filters asks the API',async()=>{
 /** Both sides must be fetched/countable before pagination, never assembled from a browser page. */
 renderWithProviders(<PartyListPageContent book="main"/>);await screen.findByText(person.name);
 fireEvent.click(screen.getByTestId('filters-button'));
 let balance=await screen.findByRole('radiogroup',{name:'Balance'});
 fireEvent.click(within(balance).getByRole('radio',{name:'All'}));
 fireEvent.click(screen.getByTestId('filters-apply'));
 await waitFor(()=>expect(last()).toMatchObject({balance:'',book:'main',status:'active'}));
 fireEvent.click(screen.getByTestId('filters-button'));
 balance=await screen.findByRole('radiogroup',{name:'Balance'});
 fireEvent.click(within(balance).getByRole('radio',{name:'To give'}));
 fireEvent.click(screen.getByTestId('filters-apply'));
 await waitFor(()=>expect(last()).toMatchObject({balance:'i_owe',book:'main'}));
});
it('an empty Due view keeps filters and offers Show all people',async()=>{
 /** An existing settled book is not a first-use blank; the default needs a real way out. */
 service.listParties.mockResolvedValue({...result,rows:[],meta:{...result.meta,total:0,totalPages:0},totals:{receivable:'0.00',payable:'0.00'}});
 renderWithProviders(<PartyListPageContent book="main"/>);
 const all=await screen.findByRole('button',{name:'Show all people'});expect(screen.getByTestId('filters-button')).toBeInTheDocument();fireEvent.click(all);await waitFor(()=>expect(last().balance).toBe(''));
});
it('loads another page without replacing the Udhaar cards',async()=>{
 /** Mobile must opt into the same append/retry contract as the Shop. */
 service.listParties.mockImplementation((params:PartyListParams)=>Promise.resolve(params.page===2?{...result,rows:[{...person,id:'22222222-2222-4222-8222-222222222222',name:'Electrical parts customer'}],meta:{...result.meta,page:2}}:result));
 renderWithProviders(<PartyListPageContent book="main"/>);await screen.findByText(person.name);fireEvent.click(screen.getByRole('button',{name:'Load more'}));await screen.findByText('Electrical parts customer');expect(screen.getByText(person.name)).toBeInTheDocument();
});
it('keeps advanced hidden-person and sort choices in one filter sheet',async()=>{
 const user=userEvent.setup();renderWithProviders(<PartyListPageContent book="main"/>);await screen.findByText(person.name);await user.click(screen.getByTestId('filters-button'));
 const group=await screen.findByRole('radiogroup',{name:'People'});await user.click(within(group).getByRole('radio',{name:'Hidden people'}));await user.click(screen.getByTestId('filters-apply'));await waitFor(()=>expect(last()).toMatchObject({status:'archived',balance:''}));
});

it('never paints Shop money under the Udhaar heading during a book switch',async()=>{
 /** Shared Redux rows can outlive the Shop screen; Udhaar must wait for its own book. */
 const shop={...person,name:'Shop-only LED purchase',balance:'9000.00'};
 service.listParties.mockImplementation((params:PartyListParams)=>params.book==='shop'
   ?Promise.resolve({...result,rows:[shop],meta:{...result.meta,total:1,totalPages:1},totals:{receivable:'9000.00',payable:'0.00'}})
   :new Promise(()=>undefined));
 mockPath='/customers';const view=renderWithProviders(<PartyListPageContent kind="customer" book="shop"/>);
 await screen.findByText('Shop-only LED purchase');view.unmount();
 mockPath='/khata';renderWithProviders(<PartyListPageContent book="main"/>);
 expect(screen.queryByText('Shop-only LED purchase')).not.toBeInTheDocument();
 expect(screen.queryByText('₹9,000.00')).not.toBeInTheDocument();
});

it('does not send Udhaar Due to the Shop list from a shared link',async()=>{
 /** BP-20 is a main-book read only; a hand-edited Shop URL must not reach it. */
 mockPath='/customers';mockSearch='balance=due';
 renderWithProviders(<PartyListPageContent kind="customer" book="shop"/>);
 await screen.findByText(person.name);
 expect(service.listParties.mock.calls.filter(([params]:[PartyListParams])=>params.book==='shop').every(([params]:[PartyListParams])=>params.balance!== 'due')).toBe(true);
});

it('adds a person with name and opening amount, then opens that khata only after save',async()=>{
 /** A fast Udhaar add should not expose Shop roles and should never navigate before the API answers. */
 const user=userEvent.setup();let finish:(value:unknown)=>void=()=>undefined;
 service.createParty.mockReturnValue(new Promise((resolve)=>{finish=resolve;}));
 renderWithProviders(<PartyListPageContent book="main"/>);await screen.findByText(person.name);
 const add = screen.getAllByRole('button',{name:'Add person'}).at(0);
 if (!add) throw new Error('Add person is missing');
 await user.click(add);
 const drawer=await screen.findByRole('dialog',{name:'Add person'});
 expect(within(drawer).getByLabelText('Name')).toBeInTheDocument();
 expect(within(drawer).getByLabelText('Amount')).toBeInTheDocument();
 expect(within(drawer).getByRole('radio',{name:'Gave money'})).toBeInTheDocument();
 expect(within(drawer).queryByText('GSTIN')).not.toBeInTheDocument();
 await user.type(within(drawer).getByLabelText('Name'),'Radhe Krishna Enterprises');
 await user.click(within(drawer).getByRole('button',{name:'Save and open khata'}));
 expect(service.createParty).not.toHaveBeenCalled();
 expect(await within(drawer).findByText('Enter an amount.')).toBeInTheDocument();
 await user.type(within(drawer).getByLabelText('Amount'),'500');
 await user.click(within(drawer).getByRole('button',{name:'Save and open khata'}));
 await waitFor(()=>expect(service.createParty).toHaveBeenCalled());
 expect(service.createParty.mock.calls[0][0]).toMatchObject({name:'Radhe Krishna Enterprises',openingAmount:'500.00',openingDirection:'debit'});
 expect(push).not.toHaveBeenCalled();
 finish({party:{...person,name:'Radhe Krishna Enterprises'},warnings:[]});
 await waitFor(()=>expect(push).toHaveBeenCalledWith('/parties/'+person.id));
});
