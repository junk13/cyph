#!/usr/bin/env node


const {config}				= require('../modules/config');
const {CyphPlans}			= require('../modules/proto');
const {readableByteLength}	= require('../modules/util');
const {addInviteCode}		= require('./addinvitecode');
const {sendMail}			= require('./email');


const inviteUser	= async (projectId, email, name, plan, reservedUsername) => {


/* TODO: Handle other cases */
const accountsURL	= projectId === 'cyphme' ? 'https://cyph.app/' : 'https://staging.cyph.app/';

const inviteCode	= (await addInviteCode(
	projectId,
	{'': 1},
	undefined,
	plan,
	reservedUsername
))[''][0];

const cyphPlan		= CyphPlans[plan] || CyphPlans.Free;
const planConfig	= config.planConfig[cyphPlan];

await sendMail(
	!email ? undefined : !name ? email : `${name} <${email}>`,
	'Your Cyph Invite',
	{
		data: {
			...planConfig,
			inviteCode,
			name,
			planFoundersAndFriends: cyphPlan === CyphPlans.FoundersAndFriends,
			planFree: cyphPlan === CyphPlans.Free,
			planGold: cyphPlan === CyphPlans.Gold,
			planLifetimePlatinum: cyphPlan === CyphPlans.LifetimePlatinum,
			planSilver: cyphPlan === CyphPlans.Silver,
			platinumFeatures: planConfig.usernameMinLength === 1,
			storageCap: readableByteLength(planConfig.storageCapGB, 'gb')
		},
		templateName: 'new-cyph-invite'
	},
	undefined,
	undefined,
	accountsURL
);

return inviteCode;


};


if (require.main === module) {
	(async () => {
		const projectId			= process.argv[2];
		const email				= process.argv[3];
		const name				= process.argv[4];
		const plan				= process.argv[5];
		const reservedUsername	= process.argv[6];

		console.log(`Invited with invite code ${await inviteUser(
			projectId,
			email,
			name,
			plan,
			reservedUsername
		)}`);

		process.exit(0);
	})().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
else {
	module.exports	= {inviteUser};
}
