import {Injectable} from '@angular/core';
import {ActivatedRoute, NavigationEnd, NavigationStart, Router} from '@angular/router';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {filter, map, mergeMap} from 'rxjs/operators';
import {User} from '../account';
import {BaseProvider} from '../base-provider';
import {ContactComponent} from '../components/contact';
import {toBehaviorSubject} from '../util/flatten-observable';
import {translate} from '../util/translate';
import {resolvable, sleep} from '../util/wait';
import {AccountContactsService} from './account-contacts.service';
import {ConfigService} from './config.service';
import {DialogService} from './dialog.service';
import {EnvService} from './env.service';
import {WindowWatcherService} from './window-watcher.service';


/**
 * Account service.
 */
@Injectable()
export class AccountService extends BaseProvider {
	/** @ignore */
	private readonly _UI_READY	= resolvable();

	/** @ignore */
	private readonly headerInternal: BehaviorSubject<string|User|undefined>	=
		new BehaviorSubject<string|User|undefined>(undefined)
	;

	/** @ignore */
	private readonly menuExpandedInternal: BehaviorSubject<boolean>		=
		new BehaviorSubject(!this.envService.isMobile)
	;

	/** @ignore */
	private readonly mobileMenuOpenInternal: BehaviorSubject<boolean>	=
		new BehaviorSubject(false)
	;

	/** @ignore */
	private readonly transitionInternal: BehaviorSubject<boolean>		=
		new BehaviorSubject(false)
	;

	/** Header title for current section. */
	public readonly header: Observable<string|User|undefined>;

	/** Indicates whether real-time Docs is enabled. */
	public readonly enableDocs: boolean					=
		this.envService.debug || (
			!!this.envService.environment.customBuild &&
			this.envService.environment.customBuild.config.enableDocs === true
		)
	;

	/** Indicates whether Wallets is enabled. */
	public readonly enableWallets: boolean				=
		this.envService.debug || (
			!!this.envService.environment.customBuild &&
			this.envService.environment.customBuild.config.enableWallets === true
		)
	;

	/** Indicates the status of the interstitial. */
	public readonly interstitial						= new BehaviorSubject<boolean>(false);

	/** Indicates whether the UI is ready. */
	public readonly isUiReady							= new BehaviorSubject<boolean>(false);

	/** Maximum length of profile description. */
	public readonly maxDescriptionLength: number		= 1000;

	/** Maximum length of name. */
	public readonly maxNameLength: number				= 250;

	/** Indicates whether menu can be expanded. */
	public readonly menuExpandable: Observable<boolean>;

	/** Indicates whether menu is expanded. */
	public readonly menuExpanded: Observable<boolean>;

	/** Minimum expanded menu width. */
	public readonly menuExpandedMinWidth: number		= this.envService.isTelehealth ? 325 : 275;

	/** Minimum expanded menu width pixels string. */
	public readonly menuExpandedMinWidthPX: string		=
		`${this.menuExpandedMinWidth.toString()}px`
	;

	/** Menu width. */
	public readonly menuMaxWidth: Observable<string>;

	/** Menu minimum width. */
	public readonly menuMinWidth: number				= this.menuExpandedMinWidth * 2.5;

	/** Indicates whether simplified menu should be displayed. */
	public readonly menuReduced: Observable<boolean>	=
		this.windowWatcherService.width.pipe(map(width =>
			width <= this.configService.responsiveMaxWidths.xs
		))
	;

	/** Indicates whether mobile menu is open. */
	public readonly mobileMenuOpen: Observable<boolean>	= combineLatest(
		this.mobileMenuOpenInternal,
		this.windowWatcherService.width
	).pipe(map(([mobileMenuOpen, width]) =>
		mobileMenuOpen &&
		width <= this.configService.responsiveMaxWidths.sm
	));

	/** Resolves ready promise. */
	public readonly resolveUiReady: () => void			= this._UI_READY.resolve;

	/** Route change listener. */
	public readonly routeChanges						= toBehaviorSubject<string>(
		this.router.events.pipe(
			filter(event => event instanceof NavigationEnd && event.url !== this.currentRoute),
			map(({url}: NavigationEnd) => url)
		),
		this.router.url,
		this.subscriptions
	);

	/** Root for account routes. */
	public readonly routeRoot: string					=
		accountRoot === '' ? '/' : `/${accountRoot}/`
	;

	/** Indicates when view is in transition. */
	public readonly transition: Observable<boolean>		= this.transitionInternal;

	/** Resolves after UI is ready. */
	public readonly uiReady: Promise<void>				= this._UI_READY.promise;

	/** Total count of unread messages. */
	public readonly unreadMessages: Observable<number>	= toBehaviorSubject(
		this.accountContactsService.contactList.pipe(
			mergeMap(users => combineLatest(users.map(user => user.unreadMessageCount))),
			map(unreadCounts => unreadCounts.reduce((a, b) => a + b, 0))
		),
		0,
		this.subscriptions
	);

	/** @ignore */
	private get currentRoute () : string {
		return this.routeChanges.value;
	}

	/** Contact form dialog. */
	public async contactFormDialog (to?: string) : Promise<void> {
		await this.dialogService.baseDialog(ContactComponent, o => {
			if (to) {
				o.hideToDropdown	= true;
				o.to				= to;
			}
		});
	}

	/** Current route path. */
	public get routePath () : string[] {
		const route	= (
			this.activatedRoute.snapshot.firstChild &&
			this.activatedRoute.snapshot.firstChild.firstChild &&
			this.activatedRoute.snapshot.firstChild.firstChild.url.length > 0
		) ?
			this.activatedRoute.snapshot.firstChild.firstChild.url :
			undefined
		;

		return route ? route.map(o => o.path) : [];
	}

	/** Sets custom header text. */
	public setHeader (header: string|User) : void {
		this.headerInternal.next(header);
	}

	/** Toggles account menu. */
	public toggleMenu (menuExpanded?: boolean) : void {
		this.menuExpandedInternal.next(typeof menuExpanded === 'boolean' ?
			menuExpanded :
			!this.menuExpandedInternal.value
		);
	}

	/** Toggles mobile account menu. */
	public toggleMobileMenu (menuOpen?: boolean) : void {
		if (typeof menuOpen !== 'boolean') {
			menuOpen	= !this.mobileMenuOpenInternal.value;
		}

		if (menuOpen && this.envService.isWeb && !this.envService.isCordova) {
			history.pushState(undefined, undefined);
		}

		this.mobileMenuOpenInternal.next(menuOpen);
	}

	/** Triggers event to ends transition between components. */
	public async transitionEnd () : Promise<void> {
		await sleep(0);
		this.transitionInternal.next(false);
	}

	constructor (
		/** @ignore */
		private readonly activatedRoute: ActivatedRoute,

		/** @ignore */
		private readonly router: Router,

		/** @ignore */
		private readonly accountContactsService: AccountContactsService,

		/** @ignore */
		private readonly configService: ConfigService,

		/** @ignore */
		private readonly dialogService: DialogService,

		/** @ignore */
		private readonly envService: EnvService,

		/** @ignore */
		private readonly windowWatcherService: WindowWatcherService
	) {
		super();

		if (this.envService.isWeb && !this.envService.isCordova) {
			self.addEventListener('popstate', () => {
				this.mobileMenuOpenInternal.next(false);
			});
		}

		this.header	= combineLatest(
			this.headerInternal,
			this.windowWatcherService.width,
			this.transitionInternal
		).pipe(map(([header, width]) => {
			const routePath	= this.routePath;
			const route		= routePath[0];

			const specialCases: {[k: string]: string}	= {
				ehr: 'EHR'
			};

			/* No header */
			if (
				[
					'register'
				].indexOf(route) > -1 ||
				(
					[
						'appointments',
						'audio',
						'video'
					].indexOf(route) > -1 &&
					routePath.length > 1 &&
					routePath[1] !== 'end'
				)
			) {
				return undefined;
			}

			/* No header until explicitly set via accountService.setHeader */
			if (
				[
					'messages',
					'profile'
				].indexOf(route) > -1 &&
				(
					routePath.length > 1
				)
			) {
				/* Always make at least an empty string on mobile to ensure menu bar displays */
				return width <= this.configService.responsiveMaxWidths.sm ?
					(header || '') :
					header
				;
			}

			/*
				No header by default for non-whitelisted sections,
				or deep routes of non-whitelisted sections
			*/
			if (
				[
					'appointments',
					'contacts',
					'docs',
					'ehr-access',
					'files',
					'forms',
					'incoming-patient-info',
					'notes',
					'patients',
					'settings',
					'staff',
					'wallets'
				].indexOf(route) < 0 || (
					[
						'docs',
						'ehr-access',
						'files',
						'forms',
						'incoming-patient-info',
						'notes',
						'settings',
						'wallets'
					].indexOf(route) < 0 &&
					routePath.length > 1
				)
			) {
				/* Always make at least an empty string on mobile to ensure menu bar displays */
				return width <= this.configService.responsiveMaxWidths.sm ?
					(header || '') :
					undefined
				;
			}

			return header || translate(route.
				split('-').
				map(s => specialCases[s] || (s[0].toUpperCase() + s.slice(1))).
				join(' ')
			);
		}));

		this.menuExpandable	= combineLatest(
			this.menuReduced,
			this.windowWatcherService.width
		).pipe(map(([menuReduced, width]) =>
			!menuReduced && width >= this.menuMinWidth
		));

		this.menuExpanded	= combineLatest(
			this.menuExpandedInternal,
			this.menuExpandable,
			this.mobileMenuOpen,
			this.windowWatcherService.width
		).pipe(map(([menuExpandedInternal, menuExpandable, mobileMenuOpen, width]) =>
			mobileMenuOpen || (
				menuExpandedInternal &&
				menuExpandable &&
				width > this.configService.responsiveMaxWidths.xs
			)
		));

		this.menuMaxWidth	= combineLatest(
			this.menuExpanded,
			this.windowWatcherService.width
		).pipe(map(([menuExpanded, width]) =>
			width <= this.configService.responsiveMaxWidths.xs ?
				'100%' :
				!menuExpanded ?
					'6em' :
					this.menuMinWidth > width ?
						'100%' :
						this.menuExpandedMinWidthPX
		));


		let lastSection	= '';
		let lastURL		= '';

		this.subscriptions.push(this.router.events.subscribe(e => {
			if (!(e instanceof NavigationStart)) {
				return;
			}

			if (e.url !== lastURL) {
				lastURL	= e.url;
				this.headerInternal.next(undefined);
			}

			let section	= (e.url.match(/^account\/(.*?)(\/|$).*/) || [])[1] || '';

			if (section === 'search') {
				section	= '';
			}

			if (section !== lastSection) {
				lastSection	= section;
				this.transitionInternal.next(true);
			}
		}));

		this.uiReady.then(() => {
			this.isUiReady.next(true);
		});
	}
}
